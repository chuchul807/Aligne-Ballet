import CoreGraphics
import Foundation
import UIKit

struct AnalysisRequest: Sendable {
    let imageData: Data
    let position: PoseName
    let supportingSide: SupportingSide
    let expectedView: ViewType
}

enum AnalysisError: String, Error, Sendable {
    case modelUnavailable
    case detectionFailed
    case renderingFailed

    var localizedKey: String {
        switch self {
        case .modelUnavailable: "analysis.error.model-unavailable"
        case .detectionFailed: "analysis.error.detection"
        case .renderingFailed: "analysis.error.rendering"
        }
    }
}

enum AnalysisOutcome {
    case retake(QualityReport)
    case success(AnalysisResult, UIImage)
    case failure(AnalysisError)
}

struct AnalysisPipeline {
    let detector: any PoseDetecting
    var normalizer = ImageNormalizer()
    var render: (CGImage, [DrawingCommand], [Landmark]) throws -> UIImage = {
        try AnnotationRenderer.render(baseImage: $0, commands: $1, landmarks: $2)
    }

    func analyze(_ request: AnalysisRequest) async -> AnalysisOutcome {
        let normalized: NormalizedImage
        do {
            normalized = try normalizer.normalize(data: request.imageData)
        } catch let error as ImageInputError {
            return .retake(Self.imageRetake(error))
        } catch {
            return .retake(Self.reasonReport(.decodeFailed))
        }

        let image = normalized.cgImage
        let size = PixelSize(width: image.width, height: image.height)
        let metrics: ImageMetrics
        do {
            metrics = try ImageMetricsCalculator.calculate(image: image)
        } catch {
            return .failure(.renderingFailed)
        }

        let whole: LandmarkSet
        do {
            whole = try await detector.detect(image: image)
        } catch {
            return .failure(.detectionFailed)
        }
        let first = QualityEvaluator.evaluate(QualityInput(
            landmarks: whole, position: request.position,
            supportingSide: request.supportingSide, expectedView: request.expectedView,
            metrics: metrics, requiredJointVisibility: .defer
        ))
        if first.status == .fail {
            return .retake(Self.withResize(first, normalized.wasResized))
        }

        guard let wholePerson = whole.people.first else {
            return .retake(Self.reasonReport(.insufficientPoseEvidence,
                                             resized: normalized.wasResized))
        }
        switch FocusedCrop.assessSubjectSize(landmarks: wholePerson, sourceSize: size) {
        case .tooSmall:
            return .retake(Self.reasonReport(.subjectTooSmall, resized: normalized.wasResized))
        case .insufficientEvidence:
            return .retake(Self.reasonReport(.insufficientPoseEvidence,
                                             resized: normalized.wasResized))
        case .usable:
            break
        }
        guard let rect = FocusedCrop.calculateRect(landmarks: wholePerson, sourceSize: size) else {
            return .retake(Self.reasonReport(.insufficientPoseEvidence,
                                             resized: normalized.wasResized))
        }

        let cropped: CGImage
        do {
            cropped = try FocusedCrop.crop(image: image, rect: rect)
        } catch {
            return .failure(.renderingFailed)
        }
        let detected: LandmarkSet
        do {
            detected = try await detector.detect(image: cropped)
        } catch {
            return .failure(.detectionFailed)
        }
        guard detected.people.count == 1 else {
            return .retake(Self.reasonReport(.unstablePoseLandmarks,
                                             regions: first.unassessableRegions,
                                             resized: normalized.wasResized))
        }
        let mapped = FocusedCrop.mapLandmarks(detected.people[0], from: rect, sourceSize: size)
        let disagreements = PoseAgreement.compare(
            whole: wholePerson, refined: mapped, sourceSize: size
        )
        let refined = LandmarkSet(people: [mapped], sourceWidth: size.width,
                                  sourceHeight: size.height)
        let second = QualityEvaluator.evaluate(QualityInput(
            landmarks: refined, position: request.position,
            supportingSide: request.supportingSide, expectedView: request.expectedView,
            metrics: metrics, requiredJointVisibility: .enforce, cameraViewCheck: .defer
        ))
        let qualityCoverage = Self.unique(first.unassessableRegions + second.unassessableRegions)
        if second.status == .fail {
            return .retake(QualityReport(
                status: .fail, reasons: second.reasons,
                unassessableRegions: qualityCoverage,
                imageWasResized: normalized.wasResized
            ))
        }

        let reliability = LandmarkReliabilityEvaluator.evaluate(
            landmarks: mapped, view: request.expectedView, disagreements: disagreements
        )
        let measurements = PoseMeasurer.measure(
            landmarks: mapped, supportingSide: request.supportingSide,
            reliability: reliability, view: request.expectedView, sourceSize: size
        )
        let viability = Self.viability(request.position, measurements)
        let combinedCoverage = Self.unique(
            qualityCoverage + viability.unavailable
                + Self.disagreementRegions(disagreements, side: request.supportingSide)
        )
        if !viability.usable {
            return .retake(Self.reasonReport(
                disagreements.isEmpty ? .insufficientPoseEvidence : .unstablePoseLandmarks,
                regions: combinedCoverage, resized: normalized.wasResized
            ))
        }

        let observations = RuleEngine.evaluate(
            rules: Self.rules(for: request.position),
            context: RuleContext(
                position: request.position, supportingSide: request.supportingSide,
                view: request.expectedView, landmarks: mapped,
                reliability: reliability, measurements: measurements
            )
        )
        let coverage = Dictionary(uniqueKeysWithValues: BodyRegion.allCases.map {
            ($0, combinedCoverage.contains($0) ? Assessability.unassessable : .assessable)
        })
        let summary = FeedbackComposer.compose(observations: observations, coverage: coverage)
        let selectedIDs = Set(summary.topCorrections.map(\.observationID))
        let selected = observations.filter { selectedIDs.contains($0.id) }
            .sorted { left, right in
                let ids = summary.topCorrections.map(\.observationID)
                return (ids.firstIndex(of: left.id) ?? Int.max)
                    < (ids.firstIndex(of: right.id) ?? Int.max)
            }
        let commands = AnnotationCommandBuilder.build(
            observations: selected, landmarks: mapped, reliability: reliability,
            supportingSide: request.supportingSide
        )
        let result = AnalysisResult(
            sessionID: UUID().uuidString, position: request.position, landmarks: mapped,
            topCorrections: summary.topCorrections,
            fullBodyReview: summary.fullBodyReview, annotations: commands,
            createdAt: ISO8601DateFormatter().string(from: Date())
        )
        do {
            let annotated = try render(image, commands, mapped)
            return .success(result, annotated)
        } catch {
            return .failure(.renderingFailed)
        }
    }

    private static func rules(for pose: PoseName) -> [Rule] {
        let specific: [Rule]
        switch pose {
        case .arabesque: specific = ArabesqueRules.all
        case .attitudeDerriere: specific = AttitudeRules.all
        case .retirePasse: specific = RetireRules.all
        case .aLaSeconde: specific = ALaSecondeRules.all
        case .tenduCroiseDevant: specific = TenduCroiseRules.all
        }
        return CommonRules.all + specific
    }

    private static func viability(
        _ position: PoseName, _ m: MeasurementSet
    ) -> (usable: Bool, unavailable: [BodyRegion]) {
        func assessable(_ items: [PoseMeasurement], minimum: Int = 1) -> Bool {
            items.filter { $0.assessability == .assessable && ($0.value?.isFinite ?? false) }
                .count >= minimum
        }
        let core: [(BodyRegion, Bool)] = [
            (.torso, assessable([m.torsoLength])),
            (.supportingLeg, assessable([m.supportingKneeAngle])),
            (.pelvis, assessable([m.pelvisSlope])),
        ]
        let specific: [(BodyRegion, Bool)]
        switch position {
        case .arabesque:
            specific = [(.workingLeg, assessable([m.workingKneeAngle,
                                                  m.workingAnkleHeightFromHip]))]
        case .attitudeDerriere:
            specific = [(.workingLeg, assessable([m.workingKneeAngle,
                                                  m.workingKneeHeightFromHip]))]
        case .retirePasse:
            specific = [
                (.workingLeg, assessable([m.workingKneeLateralOffset])),
                (.feet, assessable([m.workingAnkleToSupportingKnee])),
            ]
        case .aLaSeconde:
            specific = [
                (.workingLeg, assessable([m.workingKneeAngle, m.workingAnkleOutwardOffset])),
                (.feet, assessable([m.workingFootPointAngle, m.workingHeelVisibilityCue])),
            ]
        case .tenduCroiseDevant:
            specific = [
                (.workingLeg, assessable([m.workingKneeAngle, m.croiseCrossingSeparation])),
                (.feet, assessable([m.workingFootPointAngle,
                                    m.workingFootHeightFromSupportingFoot])),
            ]
        }
        return (
            core.filter(\.1).count >= 2 && specific.contains(where: \.1),
            unique((core + specific).filter { !$0.1 }.map(\.0))
        )
    }

    private static func disagreementRegions(
        _ points: Set<LandmarkName>, side: SupportingSide
    ) -> [BodyRegion] {
        unique(points.flatMap { name -> [BodyRegion] in
            switch name {
            case .leftShoulder, .rightShoulder: return [.shouldersArms, .torso]
            case .leftHip: return [.pelvis, .torso, side == .left ? .supportingLeg : .workingLeg]
            case .rightHip: return [.pelvis, .torso, side == .right ? .supportingLeg : .workingLeg]
            case .leftKnee: return [side == .left ? .supportingLeg : .workingLeg]
            case .rightKnee: return [side == .right ? .supportingLeg : .workingLeg]
            case .leftAnkle: return [side == .left ? .supportingLeg : .workingLeg, .feet]
            case .rightAnkle: return [side == .right ? .supportingLeg : .workingLeg, .feet]
            case .leftHeel, .rightHeel, .leftFootIndex, .rightFootIndex: return [.feet]
            case .leftElbow, .rightElbow, .leftWrist, .rightWrist,
                 .leftPinky, .rightPinky, .leftIndex, .rightIndex,
                 .leftThumb, .rightThumb: return [.shouldersArms]
            default: return [.head]
            }
        })
    }

    private static func unique(_ regions: [BodyRegion]) -> [BodyRegion] {
        BodyRegion.allCases.filter { regions.contains($0) }
    }

    private static func withResize(_ report: QualityReport, _ resized: Bool) -> QualityReport {
        QualityReport(status: report.status, reasons: report.reasons,
                      unassessableRegions: report.unassessableRegions,
                      imageWasResized: resized)
    }

    private static func imageRetake(_ error: ImageInputError) -> QualityReport {
        let reason: QualityReasonCode
        switch error.code {
        case .imageTooSmall: reason = .imageTooSmall
        case .normalisationFailed: reason = .normalisationFailed
        case .imageMemoryFailed: reason = .imageMemoryFailed
        default: reason = .decodeFailed
        }
        return reasonReport(reason)
    }

    private static func reasonReport(
        _ reason: QualityReasonCode, regions: [BodyRegion] = [], resized: Bool? = nil
    ) -> QualityReport {
        QualityReport(status: .fail, reasons: [QualityReason(
            code: reason, message: reason.rawValue
        )], unassessableRegions: regions, imageWasResized: resized)
    }
}

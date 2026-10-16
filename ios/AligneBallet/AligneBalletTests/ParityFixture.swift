import Foundation
import XCTest
@testable import AligneBallet

enum ParityTransform: String, Decodable {
    case none
    case mirror
    case collapse
}

struct ParityPoint: Decodable {
    let x: Double
    let y: Double
}

struct GeometryFixtureCase: Decodable {
    let id: String
    let operation: String
    let a: ParityPoint
    let b: ParityPoint
    let vertex: ParityPoint?
    let scale: Double?
    let expected: Double?
    let expectedPoint: ParityPoint?
}

struct ExpectedMeasurements: Decodable {
    let torsoLength: Double?
    let supportingKneeAngle: Double?
    let supportingKneeForwardDepthCue: Double?
    let workingKneeAngle: Double?
    let workingKneeForwardDepthCue: Double?
    let pelvisSlope: Double?
    let shoulderSlope: Double?
    let torsoLateralOffset: Double?
    let workingAnkleToSupportingKnee: Double?
    let workingKneeLateralOffset: Double?
    let workingKneeHeightFromHip: Double?
    let workingAnkleHeightFromHip: Double?
    let workingFootPointAngle: Double?
    let workingHeelDepthCue: Double?
    let workingHeelVisibilityCue: Double?
    let workingAnkleOutwardOffset: Double?
    let workingFootHeightFromSupportingFoot: Double?
    let croiseCrossingSeparation: Double?
    let frontalSupportingHipAnkleOffset: Double?
    let leftElbowAngle: Double?
    let rightElbowAngle: Double?
    let headTiltFromTorso: Double?

    var byName: [String: Double?] {
        [
            "torsoLength": torsoLength,
            "supportingKneeAngle": supportingKneeAngle,
            "supportingKneeForwardDepthCue": supportingKneeForwardDepthCue,
            "workingKneeAngle": workingKneeAngle,
            "workingKneeForwardDepthCue": workingKneeForwardDepthCue,
            "pelvisSlope": pelvisSlope,
            "shoulderSlope": shoulderSlope,
            "torsoLateralOffset": torsoLateralOffset,
            "workingAnkleToSupportingKnee": workingAnkleToSupportingKnee,
            "workingKneeLateralOffset": workingKneeLateralOffset,
            "workingKneeHeightFromHip": workingKneeHeightFromHip,
            "workingAnkleHeightFromHip": workingAnkleHeightFromHip,
            "workingFootPointAngle": workingFootPointAngle,
            "workingHeelDepthCue": workingHeelDepthCue,
            "workingHeelVisibilityCue": workingHeelVisibilityCue,
            "workingAnkleOutwardOffset": workingAnkleOutwardOffset,
            "workingFootHeightFromSupportingFoot": workingFootHeightFromSupportingFoot,
            "croiseCrossingSeparation": croiseCrossingSeparation,
            "frontalSupportingHipAnkleOffset": frontalSupportingHipAnkleOffset,
            "leftElbowAngle": leftElbowAngle,
            "rightElbowAngle": rightElbowAngle,
            "headTiltFromTorso": headTiltFromTorso,
        ]
    }
}

struct MeasurementFixtureCase: Decodable {
    let id: String
    let supportingSide: SupportingSide
    let view: ViewType
    let sourceSize: PixelSize
    let transform: ParityTransform
    let omittedLandmarks: [LandmarkName]
    let expectedValues: ExpectedMeasurements
    let expectedUnassessableReasons: [String: ReliabilityReason]
    let expectedLowConfidence: [String]
}

struct ParityFixture: Decodable {
    let geometryCases: [GeometryFixtureCase]
    let baseLandmarks: [Landmark]
    let measurementCases: [MeasurementFixtureCase]
}

enum ParityFixtureLoader {
    static func load() throws -> ParityFixture {
        let bundle = Bundle(for: BundleSentinel.self)
        let url = try XCTUnwrap(bundle.url(forResource: "ios-domain-parity", withExtension: "json"))
        return try JSONDecoder().decode(ParityFixture.self, from: Data(contentsOf: url))
    }

    static func landmarks(for testCase: MeasurementFixtureCase, in fixture: ParityFixture) -> [Landmark] {
        let omitted = Set(testCase.omittedLandmarks)
        return fixture.baseLandmarks.compactMap { landmark in
            let transformed: Landmark
            switch testCase.transform {
            case .none:
                transformed = landmark
            case .collapse:
                transformed = Landmark(
                    name: landmark.name,
                    x: 0.5,
                    y: 0.5,
                    z: 0.1,
                    visibility: landmark.visibility,
                    presence: landmark.presence
                )
            case .mirror:
                transformed = Landmark(
                    name: mirrored(landmark.name),
                    x: 1 - landmark.x,
                    y: landmark.y,
                    z: landmark.z,
                    visibility: landmark.visibility,
                    presence: landmark.presence
                )
            }
            return omitted.contains(transformed.name) ? nil : transformed
        }
    }

    static func reliability(for landmarks: [Landmark]) -> [LandmarkName: LandmarkReliability] {
        let present = Set(landmarks.map(\.name))
        return Dictionary(uniqueKeysWithValues: LandmarkName.allCases.map { name in
            if present.contains(name) {
                return (name, LandmarkReliability(
                    name: name,
                    confidence: .high,
                    assessability: .assessable,
                    reasons: []
                ))
            }
            return (name, LandmarkReliability(
                name: name,
                confidence: .low,
                assessability: .unassessable,
                reasons: [.missing]
            ))
        })
    }

    static func measurementsByName(_ measurements: MeasurementSet) -> [String: PoseMeasurement] {
        [
            "torsoLength": measurements.torsoLength,
            "supportingKneeAngle": measurements.supportingKneeAngle,
            "supportingKneeForwardDepthCue": measurements.supportingKneeForwardDepthCue,
            "workingKneeAngle": measurements.workingKneeAngle,
            "workingKneeForwardDepthCue": measurements.workingKneeForwardDepthCue,
            "pelvisSlope": measurements.pelvisSlope,
            "shoulderSlope": measurements.shoulderSlope,
            "torsoLateralOffset": measurements.torsoLateralOffset,
            "workingAnkleToSupportingKnee": measurements.workingAnkleToSupportingKnee,
            "workingKneeLateralOffset": measurements.workingKneeLateralOffset,
            "workingKneeHeightFromHip": measurements.workingKneeHeightFromHip,
            "workingAnkleHeightFromHip": measurements.workingAnkleHeightFromHip,
            "workingFootPointAngle": measurements.workingFootPointAngle,
            "workingHeelDepthCue": measurements.workingHeelDepthCue,
            "workingHeelVisibilityCue": measurements.workingHeelVisibilityCue,
            "workingAnkleOutwardOffset": measurements.workingAnkleOutwardOffset,
            "workingFootHeightFromSupportingFoot": measurements.workingFootHeightFromSupportingFoot,
            "croiseCrossingSeparation": measurements.croiseCrossingSeparation,
            "frontalSupportingHipAnkleOffset": measurements.frontalSupportingHipAnkleOffset,
            "leftElbowAngle": measurements.leftElbowAngle,
            "rightElbowAngle": measurements.rightElbowAngle,
            "headTiltFromTorso": measurements.headTiltFromTorso,
        ]
    }

    private static func mirrored(_ name: LandmarkName) -> LandmarkName {
        if name.rawValue.hasPrefix("left_") {
            return LandmarkName(rawValue: name.rawValue.replacingOccurrences(of: "left_", with: "right_"))!
        }
        if name.rawValue.hasPrefix("right_") {
            return LandmarkName(rawValue: name.rawValue.replacingOccurrences(of: "right_", with: "left_"))!
        }
        return name
    }
}

private final class BundleSentinel {}

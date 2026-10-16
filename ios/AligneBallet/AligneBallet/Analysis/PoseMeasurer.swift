import Foundation

enum PoseMeasurer {
    typealias ReliabilityMap = [LandmarkName: LandmarkReliability]

    static func measure(
        landmarks: [Landmark],
        supportingSide: SupportingSide,
        reliability: ReliabilityMap,
        view: ViewType,
        sourceSize: PixelSize
    ) -> MeasurementSet {
        let points = Dictionary(landmarks.map { ($0.name, $0) }, uniquingKeysWith: { _, latest in latest })
        let workingSide = supportingSide.opposite
        let leftShoulder = point(points, .leftShoulder)
        let rightShoulder = point(points, .rightShoulder)
        let leftHip = point(points, .leftHip)
        let rightHip = point(points, .rightHip)
        let shoulderMidpoint = pair(leftShoulder, rightShoulder).flatMap(Geometry.midpoint)
        let hipMidpoint = pair(leftHip, rightHip).flatMap(Geometry.midpoint)
        let torsoEvidence: [LandmarkName] = [.leftShoulder, .rightShoulder, .leftHip, .rightHip]
        let torsoLength = measurement(torsoEvidence, reliability: reliability) {
            pair(shoulderMidpoint, hipMidpoint).flatMap(Geometry.distance)
        }
        let frontalBodyWidth = measurement(torsoEvidence, reliability: reliability) {
            guard let leftShoulder, let rightShoulder, let leftHip, let rightHip else { return nil }
            return (abs(leftShoulder.x - rightShoulder.x) + abs(leftHip.x - rightHip.x)) / 2
        }

        let supportHipName = supportingSide.landmark(.hip)
        let supportKneeName = supportingSide.landmark(.knee)
        let supportAnkleName = supportingSide.landmark(.ankle)
        let workingHipName = workingSide.landmark(.hip)
        let workingKneeName = workingSide.landmark(.knee)
        let workingAnkleName = workingSide.landmark(.ankle)
        let supportingFootIndexName = supportingSide.landmark(.footIndex)
        let workingFootIndexName = workingSide.landmark(.footIndex)
        let workingHeelName = workingSide.landmark(.heel)

        let supportHip = point(points, supportHipName)
        let supportKnee = point(points, supportKneeName)
        let supportAnkle = point(points, supportAnkleName)
        let workingHip = point(points, workingHipName)
        let workingKnee = point(points, workingKneeName)
        let workingAnkle = point(points, workingAnkleName)
        let supportingFootIndex = point(points, supportingFootIndexName)
        let workingFootIndex = point(points, workingFootIndexName)
        let workingHeel = point(points, workingHeelName)
        let nose = point(points, .nose)

        return MeasurementSet(
            torsoLength: torsoLength,
            supportingKneeAngle: measurement(
                [supportHipName, supportKneeName, supportAnkleName],
                reliability: reliability
            ) {
                threePointAngle(points, supportHipName, supportKneeName, supportAnkleName)
            },
            supportingKneeForwardDepthCue: normalizedMeasurement(
                [supportHipName, supportKneeName, supportAnkleName],
                scale: frontalBodyWidth,
                reliability: reliability
            ) { bodyWidth in
                kneeForwardDepthOffset(
                    points,
                    hip: supportHipName,
                    knee: supportKneeName,
                    ankle: supportAnkleName,
                    sourceSize: sourceSize
                ).map { $0 / bodyWidth }
            },
            workingKneeAngle: measurement(
                [workingHipName, workingKneeName, workingAnkleName],
                reliability: reliability
            ) {
                threePointAngle(points, workingHipName, workingKneeName, workingAnkleName)
            },
            workingKneeForwardDepthCue: normalizedMeasurement(
                [workingHipName, workingKneeName, workingAnkleName],
                scale: frontalBodyWidth,
                reliability: reliability
            ) { bodyWidth in
                kneeForwardDepthOffset(
                    points,
                    hip: workingHipName,
                    knee: workingKneeName,
                    ankle: workingAnkleName,
                    sourceSize: sourceSize
                ).map { $0 / bodyWidth }
            },
            pelvisSlope: measurement([.leftHip, .rightHip], reliability: reliability) {
                pair(leftHip, rightHip).flatMap(Geometry.slopeDegrees)
            },
            shoulderSlope: measurement([.leftShoulder, .rightShoulder], reliability: reliability) {
                pair(leftShoulder, rightShoulder).flatMap(Geometry.slopeDegrees)
            },
            torsoLateralOffset: normalizedMeasurement(
                [.leftShoulder, .rightShoulder, supportHipName],
                scale: torsoLength,
                reliability: reliability
            ) { torso in
                guard let shoulderMidpoint, let supportHip else { return nil }
                let direction = supportingSide == .left ? 1.0 : -1.0
                return ((shoulderMidpoint.x - supportHip.x) * direction) / torso
            },
            workingAnkleToSupportingKnee: normalizedMeasurement(
                [workingAnkleName, supportKneeName],
                scale: torsoLength,
                reliability: reliability
            ) { torso in
                guard let workingAnkle, let supportKnee else { return nil }
                return Geometry.normalizedDistance(workingAnkle, supportKnee, scale: torso)
            },
            workingKneeLateralOffset: normalizedMeasurement(
                [workingKneeName, supportHipName],
                scale: torsoLength,
                reliability: reliability
            ) { torso in
                normalizedHorizontalOffset(workingKnee, supportHip, scale: torso)
            },
            workingKneeHeightFromHip: normalizedMeasurement(
                [workingHipName, workingKneeName],
                scale: torsoLength,
                reliability: reliability
            ) { torso in
                normalizedHeight(from: workingHip, to: workingKnee, scale: torso)
            },
            workingAnkleHeightFromHip: normalizedMeasurement(
                [supportHipName, workingAnkleName],
                scale: torsoLength,
                reliability: reliability
            ) { torso in
                normalizedHeight(from: supportHip, to: workingAnkle, scale: torso)
            },
            workingFootPointAngle: measurement(
                [workingKneeName, workingAnkleName, workingFootIndexName],
                reliability: reliability
            ) {
                threePointAngle(points, workingKneeName, workingAnkleName, workingFootIndexName)
            },
            workingHeelDepthCue: normalizedMeasurement(
                [workingHeelName, workingFootIndexName],
                scale: frontalBodyWidth,
                reliability: reliability
            ) { bodyWidth in
                guard let heelDepth = depth(points, workingHeelName),
                      let toeDepth = depth(points, workingFootIndexName) else { return nil }
                return (toeDepth - heelDepth) / bodyWidth
            },
            workingHeelVisibilityCue: view == .front
                ? normalizedMeasurement(
                    [supportHipName, workingHipName, workingHeelName, workingFootIndexName],
                    scale: frontalBodyWidth,
                    reliability: reliability
                ) { bodyWidth in
                    guard let supportHip, let workingHip, let workingHeel, let workingFootIndex else { return nil }
                    let direction = sign(workingHip.x - supportHip.x)
                    guard direction != 0 else { return nil }
                    return ((workingFootIndex.x - workingHeel.x) * direction) / bodyWidth
                }
                : unsupportedViewMeasurement(
                    uniqueEvidence(
                        [supportHipName, workingHipName, workingHeelName, workingFootIndexName],
                        frontalBodyWidth.evidence
                    ),
                    reliability: reliability
                ),
            workingAnkleOutwardOffset: normalizedMeasurement(
                [supportHipName, workingHipName, workingAnkleName],
                scale: torsoLength,
                reliability: reliability
            ) { torso in
                guard let supportHip, let workingHip, let workingAnkle else { return nil }
                let direction = sign(workingHip.x - supportHip.x)
                guard direction != 0 else { return nil }
                return ((workingAnkle.x - workingHip.x) * direction) / torso
            },
            workingFootHeightFromSupportingFoot: normalizedMeasurement(
                [supportingFootIndexName, workingFootIndexName],
                scale: torsoLength,
                reliability: reliability
            ) { torso in
                guard let supportingFootIndex, let workingFootIndex else { return nil }
                return abs(supportingFootIndex.y - workingFootIndex.y) / torso
            },
            croiseCrossingSeparation: normalizedMeasurement(
                [supportHipName, workingHipName, supportAnkleName, workingAnkleName],
                scale: torsoLength,
                reliability: reliability
            ) { torso in
                guard let supportHip, let workingHip, let supportAnkle, let workingAnkle else { return nil }
                let direction = sign(supportHip.x - workingHip.x)
                guard direction != 0 else { return nil }
                return ((workingAnkle.x - supportAnkle.x) * direction) / torso
            },
            frontalSupportingHipAnkleOffset: view == .front
                ? normalizedMeasurement(
                    [supportHipName, supportAnkleName],
                    scale: torsoLength,
                    reliability: reliability
                ) { torso in
                    normalizedHorizontalOffset(supportHip, supportAnkle, scale: torso)
                }
                : unsupportedViewMeasurement(
                    uniqueEvidence([supportHipName, supportAnkleName], torsoLength.evidence),
                    reliability: reliability
                ),
            leftElbowAngle: measurement([.leftShoulder, .leftElbow, .leftWrist], reliability: reliability) {
                threePointAngle(points, .leftShoulder, .leftElbow, .leftWrist)
            },
            rightElbowAngle: measurement([.rightShoulder, .rightElbow, .rightWrist], reliability: reliability) {
                threePointAngle(points, .rightShoulder, .rightElbow, .rightWrist)
            },
            headTiltFromTorso: measurement(
                [.nose, .leftShoulder, .rightShoulder, .leftHip, .rightHip],
                reliability: reliability
            ) {
                axisDifference(
                    pair(nose, shoulderMidpoint).flatMap(Geometry.slopeDegrees),
                    pair(shoulderMidpoint, hipMidpoint).flatMap(Geometry.slopeDegrees)
                )
            }
        )
    }

    private static let confidenceRank: [Confidence: Int] = [.low: 0, .medium: 1, .high: 2]

    private static func lowestConfidence(
        _ evidence: [LandmarkName],
        reliability: ReliabilityMap
    ) -> Confidence {
        evidence.reduce(.high) { lowest, name in
            let confidence = reliability[name]?.confidence ?? .low
            return confidenceRank[confidence, default: 0] < confidenceRank[lowest, default: 0]
                ? confidence
                : lowest
        }
    }

    private static func uniqueEvidence(_ groups: [LandmarkName]...) -> [LandmarkName] {
        var seen = Set<LandmarkName>()
        return groups.flatMap { $0 }.filter { seen.insert($0).inserted }
    }

    private static func measurement(
        _ evidence: [LandmarkName],
        reliability: ReliabilityMap,
        calculate: () -> Double?
    ) -> PoseMeasurement {
        let confidence = lowestConfidence(evidence, reliability: reliability)
        for name in evidence {
            guard let entry = reliability[name] else {
                return unavailable(evidence, confidence: confidence, reason: .missing)
            }
            if entry.assessability == .unassessable {
                return unavailable(evidence, confidence: confidence, reason: entry.reasons.first ?? .missing)
            }
        }

        guard let value = calculate(), value.isFinite else {
            return unavailable(evidence, confidence: confidence, reason: .missingGeometry)
        }
        return PoseMeasurement(
            value: value,
            confidence: confidence,
            assessability: .assessable,
            evidence: evidence
        )
    }

    private static func normalizedMeasurement(
        _ evidence: [LandmarkName],
        scale: PoseMeasurement,
        reliability: ReliabilityMap,
        calculate: (Double) -> Double?
    ) -> PoseMeasurement {
        let combinedEvidence = uniqueEvidence(evidence, scale.evidence)
        let confidence = lowestConfidence(combinedEvidence, reliability: reliability)
        guard scale.assessability == .assessable, let scaleValue = scale.value, scaleValue > 0 else {
            return unavailable(combinedEvidence, confidence: confidence, reason: .missingGeometry)
        }
        return measurement(combinedEvidence, reliability: reliability) {
            calculate(scaleValue)
        }
    }

    private static func unsupportedViewMeasurement(
        _ evidence: [LandmarkName],
        reliability: ReliabilityMap
    ) -> PoseMeasurement {
        unavailable(
            evidence,
            confidence: lowestConfidence(evidence, reliability: reliability),
            reason: .unsupportedView
        )
    }

    private static func unavailable(
        _ evidence: [LandmarkName],
        confidence: Confidence,
        reason: ReliabilityReason
    ) -> PoseMeasurement {
        PoseMeasurement(
            value: nil,
            confidence: confidence,
            assessability: .unassessable,
            evidence: evidence,
            reason: reason
        )
    }

    private static func point(
        _ points: [LandmarkName: Landmark],
        _ name: LandmarkName
    ) -> Geometry.Point? {
        guard let landmark = points[name], landmark.x.isFinite, landmark.y.isFinite else { return nil }
        return Geometry.Point(x: landmark.x, y: landmark.y)
    }

    private static func depth(_ points: [LandmarkName: Landmark], _ name: LandmarkName) -> Double? {
        guard let value = points[name]?.z, value.isFinite else { return nil }
        return value
    }

    private static func threePointAngle(
        _ points: [LandmarkName: Landmark],
        _ first: LandmarkName,
        _ vertex: LandmarkName,
        _ last: LandmarkName
    ) -> Double? {
        guard let a = point(points, first), let b = point(points, vertex), let c = point(points, last) else {
            return nil
        }
        return Geometry.angleDegrees(a, vertex: b, c)
    }

    private static func kneeForwardDepthOffset(
        _ points: [LandmarkName: Landmark],
        hip: LandmarkName,
        knee: LandmarkName,
        ankle: LandmarkName,
        sourceSize: PixelSize
    ) -> Double? {
        guard let hipPoint = point(points, hip),
              let kneePoint = point(points, knee),
              let anklePoint = point(points, ankle),
              let hipDepth = depth(points, hip),
              let kneeDepth = depth(points, knee),
              let ankleDepth = depth(points, ankle) else { return nil }

        let width = Double(sourceSize.width)
        let height = Double(sourceSize.height)
        let legX = (anklePoint.x - hipPoint.x) * width
        let legY = (anklePoint.y - hipPoint.y) * height
        let squaredLegLength = legX * legX + legY * legY
        guard squaredLegLength != 0 else { return nil }

        let progress = (
            (kneePoint.x - hipPoint.x) * width * legX
                + (kneePoint.y - hipPoint.y) * height * legY
        ) / squaredLegLength
        let kneeProgress = max(0, min(1, progress))
        let straightLegDepth = hipDepth + (ankleDepth - hipDepth) * kneeProgress
        return straightLegDepth - kneeDepth
    }

    private static func normalizedHorizontalOffset(
        _ a: Geometry.Point?,
        _ b: Geometry.Point?,
        scale: Double
    ) -> Double? {
        guard let a, let b, scale.isFinite, scale > 0 else { return nil }
        return abs(a.x - b.x) / scale
    }

    private static func normalizedHeight(
        from: Geometry.Point?,
        to: Geometry.Point?,
        scale: Double
    ) -> Double? {
        guard let from, let to, scale.isFinite, scale > 0 else { return nil }
        return (from.y - to.y) / scale
    }

    private static func axisDifference(_ first: Double?, _ second: Double?) -> Double? {
        guard let first, let second, first.isFinite, second.isFinite else { return nil }
        let raw = abs(first - second).truncatingRemainder(dividingBy: 180)
        return raw > 90 ? 180 - raw : raw
    }

    private static func pair<T>(_ first: T?, _ second: T?) -> (T, T)? {
        guard let first, let second else { return nil }
        return (first, second)
    }

    private static func sign(_ value: Double) -> Double {
        if value == 0 { return 0 }
        return value > 0 ? 1 : -1
    }
}

private extension Optional where Wrapped == (Geometry.Point, Geometry.Point) {
    func flatMap(_ transform: (Geometry.Point, Geometry.Point) -> Geometry.Point?) -> Geometry.Point? {
        guard let (first, second) = self else { return nil }
        return transform(first, second)
    }

    func flatMap(_ transform: (Geometry.Point, Geometry.Point) -> Double?) -> Double? {
        guard let (first, second) = self else { return nil }
        return transform(first, second)
    }
}

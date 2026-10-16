import Foundation

let MAJOR_JOINT_AGREEMENT = 0.12
let FLEXIBLE_JOINT_AGREEMENT = 0.18

enum PoseAgreement {
    private static let minimumEvidence = 0.60
    private static let kneeForwardDepthThreshold = 0.03
    private static let majorJoints: Set<SideJoint> = [.shoulder, .elbow, .hip, .knee, .ankle]
    private static let footDepthPairs: [(LandmarkName, LandmarkName)] = [
        (.leftHeel, .leftFootIndex), (.rightHeel, .rightFootIndex),
    ]
    private static let kneeDepthChains: [(LandmarkName, LandmarkName, LandmarkName)] = [
        (.leftHip, .leftKnee, .leftAnkle), (.rightHip, .rightKnee, .rightAnkle),
    ]

    static func compare(
        whole: [Landmark],
        refined: [Landmark],
        sourceSize: PixelSize
    ) -> Set<LandmarkName> {
        let wholePoints = index(whole)
        let refinedPoints = index(refined)
        guard let refinedTorso = torsoLength(refinedPoints, sourceSize: sourceSize) else {
            return Set(LandmarkName.allCases)
        }

        var unstable = Set<LandmarkName>()
        for name in LandmarkName.allCases {
            guard let wholePoint = wholePoints[name], valid(wholePoint),
                  let refinedPoint = refinedPoints[name], valid(refinedPoint) else {
                unstable.insert(name)
                continue
            }
            let distance = hypot(
                (wholePoint.x - refinedPoint.x) * Double(sourceSize.width),
                (wholePoint.y - refinedPoint.y) * Double(sourceSize.height)
            )
            let ratio = isMajor(name) ? MAJOR_JOINT_AGREEMENT : FLEXIBLE_JOINT_AGREEMENT
            if !distance.isFinite || distance > ratio * refinedTorso {
                unstable.insert(name)
            }
        }

        for (heelName, toeName) in footDepthPairs {
            let wholeCue = footDepthCue(wholePoints, heel: heelName, toe: toeName)
            let refinedCue = footDepthCue(refinedPoints, heel: heelName, toe: toeName)
            let onePassMissing = (wholeCue == nil) != (refinedCue == nil)
            let orderChanged = wholeCue != nil && refinedCue != nil
                && sign(wholeCue!) != sign(refinedCue!)
            if onePassMissing || orderChanged {
                unstable.insert(heelName)
                unstable.insert(toeName)
            }
        }

        for (hipName, kneeName, ankleName) in kneeDepthChains {
            let wholeCue = kneeDepthCue(
                wholePoints,
                hip: hipName,
                knee: kneeName,
                ankle: ankleName,
                sourceSize: sourceSize
            )
            let refinedCue = kneeDepthCue(
                refinedPoints,
                hip: hipName,
                knee: kneeName,
                ankle: ankleName,
                sourceSize: sourceSize
            )
            let onePassMissing = (wholeCue == nil) != (refinedCue == nil)
            let directionChanged = wholeCue != nil && refinedCue != nil && (
                (wholeCue! > kneeForwardDepthThreshold && refinedCue! <= 0)
                    || (refinedCue! > kneeForwardDepthThreshold && wholeCue! <= 0)
            )
            if onePassMissing || directionChanged {
                unstable.insert(kneeName)
            }
        }
        return unstable
    }

    private static func valid(_ point: Landmark) -> Bool {
        point.x.isFinite
            && point.y.isFinite
            && point.x >= 0 && point.x <= 1
            && point.y >= 0 && point.y <= 1
            && (point.z?.isFinite ?? true)
            && point.visibility.isFinite
            && point.visibility >= minimumEvidence
            && (point.presence.map { $0.isFinite && $0 >= minimumEvidence } ?? true)
    }

    private static func index(_ landmarks: [Landmark]) -> [LandmarkName: Landmark] {
        var result = [LandmarkName: Landmark]()
        landmarks.forEach { result[$0.name] = $0 }
        return result
    }

    private static func torsoLength(
        _ points: [LandmarkName: Landmark],
        sourceSize: PixelSize
    ) -> Double? {
        guard
            let leftShoulder = points[.leftShoulder], valid(leftShoulder),
            let rightShoulder = points[.rightShoulder], valid(rightShoulder),
            let leftHip = points[.leftHip], valid(leftHip),
            let rightHip = points[.rightHip], valid(rightHip)
        else {
            return nil
        }
        let shoulderX = (leftShoulder.x + rightShoulder.x) / 2
        let shoulderY = (leftShoulder.y + rightShoulder.y) / 2
        let hipX = (leftHip.x + rightHip.x) / 2
        let hipY = (leftHip.y + rightHip.y) / 2
        let length = hypot(
            (shoulderX - hipX) * Double(sourceSize.width),
            (shoulderY - hipY) * Double(sourceSize.height)
        )
        return length.isFinite && length > 0 ? length : nil
    }

    private static func frontalBodyWidth(_ points: [LandmarkName: Landmark]) -> Double? {
        guard
            let leftShoulder = points[.leftShoulder], valid(leftShoulder),
            let rightShoulder = points[.rightShoulder], valid(rightShoulder),
            let leftHip = points[.leftHip], valid(leftHip),
            let rightHip = points[.rightHip], valid(rightHip)
        else {
            return nil
        }
        let width = (
            abs(leftShoulder.x - rightShoulder.x)
                + abs(leftHip.x - rightHip.x)
        ) / 2
        return width.isFinite && width > 0 ? width : nil
    }

    private static func isMajor(_ name: LandmarkName) -> Bool {
        let raw = name.rawValue
        let joint = raw.hasPrefix("left_") ? String(raw.dropFirst(5))
            : raw.hasPrefix("right_") ? String(raw.dropFirst(6))
            : raw
        return SideJoint(rawValue: joint).map(majorJoints.contains) ?? false
    }

    private static func footDepthCue(
        _ points: [LandmarkName: Landmark],
        heel: LandmarkName,
        toe: LandmarkName
    ) -> Double? {
        guard let heelDepth = points[heel]?.z, heelDepth.isFinite,
              let toeDepth = points[toe]?.z, toeDepth.isFinite else {
            return nil
        }
        return toeDepth - heelDepth
    }

    private static func kneeDepthCue(
        _ points: [LandmarkName: Landmark],
        hip hipName: LandmarkName,
        knee kneeName: LandmarkName,
        ankle ankleName: LandmarkName,
        sourceSize: PixelSize
    ) -> Double? {
        guard
            let hip = points[hipName], valid(hip), let hipDepth = hip.z,
            let knee = points[kneeName], valid(knee), let kneeDepth = knee.z,
            let ankle = points[ankleName], valid(ankle), let ankleDepth = ankle.z
        else {
            return nil
        }
        let legX = (ankle.x - hip.x) * Double(sourceSize.width)
        let legY = (ankle.y - hip.y) * Double(sourceSize.height)
        let squaredLength = legX * legX + legY * legY
        guard squaredLength != 0 else { return nil }
        let progress = max(0, min(1, (
            (knee.x - hip.x) * Double(sourceSize.width) * legX
                + (knee.y - hip.y) * Double(sourceSize.height) * legY
        ) / squaredLength))
        let straightLegDepth = hipDepth + (ankleDepth - hipDepth) * progress
        guard let bodyWidth = frontalBodyWidth(points) else { return nil }
        return (straightLegDepth - kneeDepth) / bodyWidth
    }

    private static func sign(_ value: Double) -> FloatingPointSign? {
        value == 0 ? nil : value.sign
    }
}

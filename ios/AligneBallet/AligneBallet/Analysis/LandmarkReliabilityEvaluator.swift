import Foundation

enum LandmarkReliabilityEvaluator {
    private static let minimumVisibility = 0.60
    private static let highVisibility = 0.80
    private static let frameMargin = 0.02
    private static let minimumAdjacentSegmentRatio = 0.35
    private static let maximumAdjacentSegmentRatio = 2.85
    private static let maximumConnectedSegmentInTorsos = 1.25
    private static let occlusionDistanceInTorsos = 0.08

    private static let geometryChains: [(LandmarkName, LandmarkName, LandmarkName)] = [
        (.leftShoulder, .leftElbow, .leftWrist),
        (.rightShoulder, .rightElbow, .rightWrist),
        (.leftHip, .leftKnee, .leftAnkle),
        (.rightHip, .rightKnee, .rightAnkle),
        (.leftAnkle, .leftHeel, .leftFootIndex),
        (.rightAnkle, .rightHeel, .rightFootIndex),
    ]

    private static let occlusionPairs: [(LandmarkName, LandmarkName)] = [
        (.leftElbow, .rightElbow),
        (.leftWrist, .rightWrist),
        (.leftKnee, .rightKnee),
        (.leftAnkle, .rightAnkle),
        (.leftHeel, .rightHeel),
        (.leftFootIndex, .rightFootIndex),
    ]

    static func evaluate(
        landmarks: [Landmark],
        view: ViewType,
        disagreements: Set<LandmarkName> = []
    ) -> [LandmarkName: LandmarkReliability] {
        _ = view
        var points = [LandmarkName: Landmark]()
        landmarks.forEach { points[$0.name] = $0 }
        var reasons = Dictionary(
            uniqueKeysWithValues: LandmarkName.allCases.map { ($0, [ReliabilityReason]()) }
        )

        func addReason(_ name: LandmarkName, _ reason: ReliabilityReason) {
            guard reasons[name]?.contains(reason) == false else { return }
            reasons[name, default: []].append(reason)
        }

        for name in LandmarkName.allCases {
            guard let point = points[name] else {
                addReason(name, .missing)
                continue
            }
            if !isFinite(point) {
                addReason(name, .nonFinite)
            }
            if !point.visibility.isFinite || point.visibility < minimumVisibility {
                addReason(name, .lowVisibility)
            }
            if let presence = point.presence,
               !presence.isFinite || presence < minimumVisibility {
                addReason(name, .lowPresence)
            }
            if disagreements.contains(name) {
                addReason(name, .crossPassDisagreement)
            }
            if point.x.isFinite, point.y.isFinite, !isInsideFrame(point) {
                addReason(name, .outsideFrame)
            }
        }

        let torso = torsoLength(points)
        for (firstName, middleName, lastName) in geometryChains {
            guard
                let first = points[firstName],
                let middle = points[middleName],
                let last = points[lastName],
                isFinite(first), isFinite(middle), isFinite(last)
            else {
                continue
            }

            let firstSegment = distance(first, middle)
            let secondSegment = distance(middle, last)
            let ratio = firstSegment / secondSegment
            if !(ratio >= minimumAdjacentSegmentRatio && ratio <= maximumAdjacentSegmentRatio) {
                addReason(middleName, .implausibleChain)
                if ratio < minimumAdjacentSegmentRatio {
                    addReason(lastName, .implausibleChain)
                }
                if ratio > maximumAdjacentSegmentRatio {
                    addReason(firstName, .implausibleChain)
                }
            }
            if let torso, torso > 0,
               firstSegment > maximumConnectedSegmentInTorsos * torso {
                addReason(firstName, .implausibleChain)
                addReason(middleName, .implausibleChain)
            }
            if let torso, torso > 0,
               secondSegment > maximumConnectedSegmentInTorsos * torso {
                addReason(middleName, .implausibleChain)
                addReason(lastName, .implausibleChain)
            }
        }

        if let torso, torso > 0 {
            for (leftName, rightName) in occlusionPairs {
                guard
                    let left = points[leftName],
                    let right = points[rightName],
                    isFinite(left), isFinite(right)
                else {
                    continue
                }
                if distance(left, right) <= occlusionDistanceInTorsos * torso {
                    addReason(leftName, .possibleOcclusion)
                    addReason(rightName, .possibleOcclusion)
                }
            }
        }

        return Dictionary(uniqueKeysWithValues: LandmarkName.allCases.map { name in
            let pointReasons = reasons[name] ?? []
            let assessability: Assessability = pointReasons.isEmpty ? .assessable : .unassessable
            let confidence: Confidence
            if assessability == .unassessable {
                confidence = .low
            } else if points[name]?.visibility ?? 0 >= highVisibility {
                confidence = .high
            } else {
                confidence = .medium
            }
            return (
                name,
                LandmarkReliability(
                    name: name,
                    confidence: confidence,
                    assessability: assessability,
                    reasons: pointReasons
                )
            )
        })
    }

    private static func isFinite(_ point: Landmark) -> Bool {
        point.x.isFinite
            && point.y.isFinite
            && point.visibility.isFinite
            && (point.z?.isFinite ?? true)
    }

    private static func isInsideFrame(_ point: Landmark) -> Bool {
        point.x >= frameMargin
            && point.x <= 1 - frameMargin
            && point.y >= frameMargin
            && point.y <= 1 - frameMargin
    }

    private static func distance(_ first: Landmark, _ second: Landmark) -> Double {
        hypot(first.x - second.x, first.y - second.y)
    }

    private static func torsoLength(_ points: [LandmarkName: Landmark]) -> Double? {
        guard
            let leftShoulder = points[.leftShoulder],
            let rightShoulder = points[.rightShoulder],
            let leftHip = points[.leftHip],
            let rightHip = points[.rightHip],
            isFinite(leftShoulder), isFinite(rightShoulder),
            isFinite(leftHip), isFinite(rightHip)
        else {
            return nil
        }
        return hypot(
            ((leftShoulder.x + rightShoulder.x) - (leftHip.x + rightHip.x)) / 2,
            ((leftShoulder.y + rightShoulder.y) - (leftHip.y + rightHip.y)) / 2
        )
    }
}

import Foundation

enum QualityCheckPolicy: Sendable {
    case enforce
    case `defer`
}

struct QualityInput: Sendable {
    let landmarks: LandmarkSet
    let position: PoseName
    let supportingSide: SupportingSide
    let expectedView: ViewType
    let metrics: ImageMetrics
    let requiredJointVisibility: QualityCheckPolicy
    let cameraViewCheck: QualityCheckPolicy

    init(
        landmarks: LandmarkSet,
        position: PoseName,
        supportingSide: SupportingSide,
        expectedView: ViewType,
        metrics: ImageMetrics,
        requiredJointVisibility: QualityCheckPolicy = .enforce,
        cameraViewCheck: QualityCheckPolicy = .enforce
    ) {
        self.landmarks = landmarks
        self.position = position
        self.supportingSide = supportingSide
        self.expectedView = expectedView
        self.metrics = metrics
        self.requiredJointVisibility = requiredJointVisibility
        self.cameraViewCheck = cameraViewCheck
    }
}

enum QualityEvaluator {
    private static let minimumMeanLuminance = 0.10
    private static let maximumMeanLuminance = 0.94
    private static let maximumTooBrightContrast = 0.10
    private static let minimumContrast = 0.075
    private static let minimumEdgeEnergy = 0.08
    private static let minimumRequiredVisibility = 0.60
    private static let frameMargin = 0.02

    private static let requiredLandmarks: [LandmarkName] = [
        .leftShoulder, .rightShoulder, .leftHip, .rightHip,
        .leftKnee, .rightKnee, .leftAnkle, .rightAnkle,
        .leftHeel, .rightHeel, .leftFootIndex, .rightFootIndex,
    ]
    private static let handLandmarks: [LandmarkName] = [.leftWrist, .rightWrist]
    private static let optionalArmLandmarks: [LandmarkName] = [
        .leftElbow, .rightElbow, .leftWrist, .rightWrist,
    ]

    static func evaluate(_ input: QualityInput) -> QualityReport {
        _ = input.position
        _ = input.supportingSide
        var reasons = [QualityReason]()
        if input.landmarks.people.isEmpty {
            reasons.append(reason(.noPerson))
        }
        if input.landmarks.people.count > 1 {
            reasons.append(reason(.multiplePeople))
        }

        let person = input.landmarks.people.count == 1 ? input.landmarks.people[0] : nil
        let points = person.map(index) ?? [:]
        if person != nil {
            let required = requiredLandmarks.map { points[$0] }
            let requiredOutside = required.contains { point in
                guard let point else { return true }
                return !isInsideFrame(point)
            }
            let visibleHandOutside = handLandmarks.contains { name in
                guard let point = points[name] else { return false }
                return point.visibility >= minimumRequiredVisibility && !isInsideFrame(point)
            }
            if requiredOutside || visibleHandOutside {
                reasons.append(reason(.bodyOutOfFrame))
            }
            if input.requiredJointVisibility != .defer,
               required.contains(where: { point in
                   guard let point else { return true }
                   return point.visibility < minimumRequiredVisibility
               }) {
                reasons.append(reason(.requiredJointsNotVisible))
            }
            if input.cameraViewCheck != .defer,
               !hasExpectedView(apparentViewRatio(points), expectedView: input.expectedView) {
                reasons.append(reason(.wrongCameraView))
            }
        }

        if input.metrics.meanLuminance < minimumMeanLuminance {
            reasons.append(reason(.tooDark))
        }
        if input.metrics.meanLuminance > maximumMeanLuminance,
           input.metrics.contrast < maximumTooBrightContrast {
            reasons.append(reason(.tooBright))
        }
        if input.metrics.contrast < minimumContrast {
            reasons.append(reason(.lowContrast))
        }
        if input.metrics.edgeEnergy < minimumEdgeEnergy {
            reasons.append(reason(.blurred))
        }

        if !reasons.isEmpty {
            return QualityReport(
                status: .fail,
                reasons: reasons,
                unassessableRegions: [],
                imageWasResized: nil
            )
        }

        let armsUnassessable = optionalArmLandmarks.contains { name in
            guard let point = points[name] else { return true }
            return point.visibility < minimumRequiredVisibility
        }
        return QualityReport(
            status: armsUnassessable ? .partial : .pass,
            reasons: [],
            unassessableRegions: armsUnassessable ? [.shouldersArms] : [],
            imageWasResized: nil
        )
    }

    static func apparentViewRatio(_ points: [LandmarkName: Landmark]) -> Double? {
        guard
            let leftShoulder = points[.leftShoulder],
            let rightShoulder = points[.rightShoulder],
            let leftHip = points[.leftHip],
            let rightHip = points[.rightHip]
        else {
            return nil
        }
        let shoulderWidth = distance(leftShoulder, rightShoulder)
        let hipWidth = distance(leftHip, rightHip)
        let shoulderX = (leftShoulder.x + rightShoulder.x) / 2
        let shoulderY = (leftShoulder.y + rightShoulder.y) / 2
        let hipX = (leftHip.x + rightHip.x) / 2
        let hipY = (leftHip.y + rightHip.y) / 2
        let torsoLength = hypot(shoulderX - hipX, shoulderY - hipY)
        return torsoLength == 0 ? nil : ((shoulderWidth + hipWidth) / 2) / torsoLength
    }

    private static func index(_ landmarks: [Landmark]) -> [LandmarkName: Landmark] {
        var result = [LandmarkName: Landmark]()
        landmarks.forEach { result[$0.name] = $0 }
        return result
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

    private static func hasExpectedView(_ ratio: Double?, expectedView: ViewType) -> Bool {
        guard let ratio else { return false }
        switch expectedView {
        case .front:
            return ratio >= 0.55
        case .threeQuarterSide:
            return ratio >= 0.25 && ratio <= 0.85
        }
    }

    private static func reason(_ code: QualityReasonCode) -> QualityReason {
        QualityReason(code: code, message: messages[code] ?? code.rawValue)
    }

    private static let messages: [QualityReasonCode: String] = [
        .noPerson: "No full body was detected. Step back and try again.",
        .multiplePeople: "Only one dancer can be analysed at a time.",
        .bodyOutOfFrame: "Keep your hands and feet inside the frame.",
        .requiredJointsNotVisible: "Make sure your hips, knees, ankles, and feet are visible.",
        .insufficientPoseEvidence: "Retake the photo with your whole body clearly visible, including shoulders, hips, knees, ankles, and feet.",
        .subjectTooSmall: "Move closer while keeping your full body, hands, and feet in the frame.",
        .unstablePoseLandmarks: "Retake the photo closer, with less clothing, barre, or limb overlap around the joints.",
        .wrongCameraView: "Match the camera angle shown in the framing guide.",
        .tooDark: "Use brighter, even lighting and try again.",
        .tooBright: "Reduce glare or backlighting and try again.",
        .lowContrast: "Use clearer lighting and fitted clothing that contrasts with the background.",
        .blurred: "Hold the camera steady and retake the photo.",
        .imageTooSmall: "Image is too small. Choose a photo with a shortest side of at least 480 pixels.",
        .normalisationFailed: "This photo could not be resized on this device. Try a smaller export or retake the photo.",
        .imageMemoryFailed: "This photo could not be decoded with the memory available on this device. Try a smaller export or retake the photo.",
        .decodeFailed: "This photo could not be decoded on this device. Try a smaller export or retake the photo.",
    ]
}

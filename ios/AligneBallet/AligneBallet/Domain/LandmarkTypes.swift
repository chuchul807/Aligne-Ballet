import Foundation

enum LandmarkName: String, Codable, CaseIterable, Sendable {
    case nose
    case leftEyeInner = "left_eye_inner"
    case leftEye = "left_eye"
    case leftEyeOuter = "left_eye_outer"
    case rightEyeInner = "right_eye_inner"
    case rightEye = "right_eye"
    case rightEyeOuter = "right_eye_outer"
    case leftEar = "left_ear"
    case rightEar = "right_ear"
    case mouthLeft = "mouth_left"
    case mouthRight = "mouth_right"
    case leftShoulder = "left_shoulder"
    case rightShoulder = "right_shoulder"
    case leftElbow = "left_elbow"
    case rightElbow = "right_elbow"
    case leftWrist = "left_wrist"
    case rightWrist = "right_wrist"
    case leftPinky = "left_pinky"
    case rightPinky = "right_pinky"
    case leftIndex = "left_index"
    case rightIndex = "right_index"
    case leftThumb = "left_thumb"
    case rightThumb = "right_thumb"
    case leftHip = "left_hip"
    case rightHip = "right_hip"
    case leftKnee = "left_knee"
    case rightKnee = "right_knee"
    case leftAnkle = "left_ankle"
    case rightAnkle = "right_ankle"
    case leftHeel = "left_heel"
    case rightHeel = "right_heel"
    case leftFootIndex = "left_foot_index"
    case rightFootIndex = "right_foot_index"
}

enum SideJoint: String, Codable, CaseIterable, Sendable {
    case eyeInner = "eye_inner"
    case eye
    case eyeOuter = "eye_outer"
    case ear
    case shoulder
    case elbow
    case wrist
    case pinky
    case index
    case thumb
    case hip
    case knee
    case ankle
    case heel
    case footIndex = "foot_index"
}

struct PixelSize: Codable, Equatable, Sendable {
    let width: Int
    let height: Int
}

struct Landmark: Codable, Equatable, Sendable {
    let name: LandmarkName
    let x: Double
    let y: Double
    let z: Double?
    let visibility: Double
    let presence: Double?

    init(
        name: LandmarkName,
        x: Double,
        y: Double,
        z: Double? = nil,
        visibility: Double,
        presence: Double? = nil
    ) {
        self.name = name
        self.x = x
        self.y = y
        self.z = z
        self.visibility = visibility
        self.presence = presence
    }
}

struct LandmarkSet: Codable, Equatable, Sendable {
    let people: [[Landmark]]
    let sourceWidth: Int
    let sourceHeight: Int
}

enum ReliabilityReason: String, Codable, CaseIterable, Sendable {
    case missing
    case nonFinite = "non-finite"
    case lowVisibility = "low-visibility"
    case lowPresence = "low-presence"
    case outsideFrame = "outside-frame"
    case implausibleChain = "implausible-chain"
    case possibleOcclusion = "possible-occlusion"
    case crossPassDisagreement = "cross-pass-disagreement"
    case missingGeometry = "missing-geometry"
    case unsupportedView = "unsupported-view"
}

struct LandmarkReliability: Codable, Equatable, Sendable {
    let name: LandmarkName
    let confidence: Confidence
    let assessability: Assessability
    let reasons: [ReliabilityReason]
}

struct PoseMeasurement: Codable, Equatable, Sendable {
    let value: Double?
    let confidence: Confidence
    let assessability: Assessability
    let evidence: [LandmarkName]
    let reason: ReliabilityReason?

    init(
        value: Double?,
        confidence: Confidence,
        assessability: Assessability,
        evidence: [LandmarkName],
        reason: ReliabilityReason? = nil
    ) {
        self.value = value
        self.confidence = confidence
        self.assessability = assessability
        self.evidence = evidence
        self.reason = reason
    }
}

struct MeasurementSet: Codable, Equatable, Sendable {
    let torsoLength: PoseMeasurement
    let supportingKneeAngle: PoseMeasurement
    let supportingKneeForwardDepthCue: PoseMeasurement
    let workingKneeAngle: PoseMeasurement
    let workingKneeForwardDepthCue: PoseMeasurement
    let pelvisSlope: PoseMeasurement
    let shoulderSlope: PoseMeasurement
    let torsoLateralOffset: PoseMeasurement
    let workingAnkleToSupportingKnee: PoseMeasurement
    let workingKneeLateralOffset: PoseMeasurement
    let workingKneeHeightFromHip: PoseMeasurement
    let workingAnkleHeightFromHip: PoseMeasurement
    let workingFootPointAngle: PoseMeasurement
    let workingHeelDepthCue: PoseMeasurement
    let workingHeelVisibilityCue: PoseMeasurement
    let workingAnkleOutwardOffset: PoseMeasurement
    let workingFootHeightFromSupportingFoot: PoseMeasurement
    let croiseCrossingSeparation: PoseMeasurement
    let frontalSupportingHipAnkleOffset: PoseMeasurement
    let leftElbowAngle: PoseMeasurement
    let rightElbowAngle: PoseMeasurement
    let headTiltFromTorso: PoseMeasurement
}

extension SupportingSide {
    var opposite: SupportingSide {
        self == .left ? .right : .left
    }

    func landmark(_ joint: SideJoint) -> LandmarkName {
        guard let name = LandmarkName(rawValue: "\(rawValue)_\(joint.rawValue)") else {
            preconditionFailure("Unsupported side landmark: \(rawValue)_\(joint.rawValue)")
        }
        return name
    }
}

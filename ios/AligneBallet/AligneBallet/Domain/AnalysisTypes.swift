import Foundation

enum PoseName: String, Codable, CaseIterable, Sendable {
    case arabesque
    case attitudeDerriere = "attitude-derriere"
    case retirePasse = "retire-passe"
    case aLaSeconde = "a-la-seconde"
    case tenduCroiseDevant = "tendu-croise-devant"
}

enum SupportingSide: String, Codable, CaseIterable, Sendable {
    case left
    case right
}

enum ViewType: String, Codable, CaseIterable, Sendable {
    case front
    case threeQuarterSide = "three-quarter-side"
}

enum FrameKind: String, Codable, CaseIterable, Sendable {
    case image
    case videoKeyframe = "video-keyframe"
}

enum Confidence: String, Codable, CaseIterable, Sendable {
    case high
    case medium
    case low
}

enum Assessability: String, Codable, CaseIterable, Sendable {
    case assessable
    case unassessable
}

enum Priority: String, Codable, CaseIterable, Sendable {
    case stability
    case structure
    case line
}

enum AnalysisStage: String, Codable, CaseIterable, Sendable {
    case select
    case frame
    case check
    case result
}

typealias AnalysisStatus = AnalysisStage

enum BodyRegion: String, Codable, CaseIterable, Sendable {
    case supportingLeg = "supporting-leg"
    case workingLeg = "working-leg"
    case pelvis
    case torso
    case shouldersArms = "shoulders-arms"
    case head
    case feet
}

struct ImageNormalisation: Codable, Equatable, Sendable {
    let wasResized: Bool
    let originalWidth: Int
    let originalHeight: Int
}

struct PoseFrame: Codable, Equatable, Sendable {
    let id: String
    let kind: FrameKind
    let view: ViewType
    let sourceWidth: Int
    let sourceHeight: Int
    let createdAt: String
}

enum AnnotationType: String, Codable, CaseIterable, Sendable {
    case joint
    case region
    case arrow
}

struct AnnotationInstruction: Codable, Equatable, Sendable {
    let observationID: String
    let type: AnnotationType
    let joints: [LandmarkName]
    let dx: Double?
    let dy: Double?

    enum CodingKeys: String, CodingKey {
        case observationID = "observationId"
        case type
        case joints
        case dx
        case dy
    }
}

struct Observation: Codable, Equatable, Sendable {
    let id: String
    let ruleID: String
    let dedupeKey: String
    let region: BodyRegion
    let priority: Priority
    let confidence: Confidence
    let evidence: [LandmarkName]
    let annotation: [AnnotationInstruction]
    let assessability: Assessability
    let issue: String?
    let action: String?
    let direction: String?
    let severity: Double?

    init(
        id: String,
        ruleID: String,
        dedupeKey: String,
        region: BodyRegion,
        priority: Priority,
        confidence: Confidence,
        evidence: [LandmarkName],
        annotation: [AnnotationInstruction],
        assessability: Assessability,
        issue: String?,
        action: String?,
        direction: String?,
        severity: Double?
    ) {
        self.id = id
        self.ruleID = ruleID
        self.dedupeKey = dedupeKey
        self.region = region
        self.priority = priority
        self.evidence = evidence
        self.annotation = annotation
        self.assessability = assessability

        if assessability == .unassessable {
            self.confidence = .low
            self.issue = nil
            self.action = nil
            self.direction = nil
            self.severity = nil
        } else {
            self.confidence = confidence
            self.issue = issue
            self.action = action
            self.direction = direction
            self.severity = severity
        }
    }

    enum CodingKeys: String, CodingKey {
        case id
        case ruleID = "ruleId"
        case dedupeKey
        case region
        case priority
        case confidence
        case evidence
        case annotation
        case assessability
        case issue
        case action
        case direction
        case severity
    }
}

enum DrawingCommand: Codable, Equatable, Sendable {
    case skeletonSegment(from: LandmarkName, to: LandmarkName)
    case structuralJoint(joint: LandmarkName)
    case highlightJoint(observationID: String, joint: LandmarkName, label: Int)
    case highlightRegion(observationID: String, joints: [LandmarkName], label: Int)
    case directionArrow(observationID: String, anchor: LandmarkName, dx: Double, dy: Double, label: Int)
}

struct FeedbackItem: Codable, Equatable, Sendable {
    let observationID: String
    let text: String
    let region: BodyRegion
    let priority: Priority
    let confidence: Confidence

    enum CodingKeys: String, CodingKey {
        case observationID = "observationId"
        case text
        case region
        case priority
        case confidence
    }
}

struct CorrectionFeedbackItem: Codable, Equatable, Sendable {
    let observationID: String
    let text: String
    let region: BodyRegion
    let priority: Priority
    let confidence: Confidence
    let ruleID: String
    let direction: String

    var feedbackItem: FeedbackItem {
        FeedbackItem(
            observationID: observationID,
            text: text,
            region: region,
            priority: priority,
            confidence: confidence
        )
    }

    enum CodingKeys: String, CodingKey {
        case observationID = "observationId"
        case text
        case region
        case priority
        case confidence
        case ruleID = "ruleId"
        case direction
    }
}

enum FullBodyStatus: String, Codable, CaseIterable, Sendable {
    case finding
    case clear
    case unassessable
}

struct FullBodySection: Codable, Equatable, Sendable {
    let region: BodyRegion
    let status: FullBodyStatus
    let items: [FeedbackItem]
}

struct AnalysisResult: Codable, Equatable, Sendable {
    let sessionID: String
    let position: PoseName
    let landmarks: [Landmark]
    let topCorrections: [CorrectionFeedbackItem]
    let fullBodyReview: [FullBodySection]
    let annotations: [DrawingCommand]
    let createdAt: String

    enum CodingKeys: String, CodingKey {
        case sessionID = "sessionId"
        case position
        case landmarks
        case topCorrections
        case fullBodyReview
        case annotations
        case createdAt
    }
}

struct AnalysisSession: Codable, Equatable, Sendable {
    let id: String
    let position: PoseName
    let supportingSide: SupportingSide
    let expectedViews: [ViewType]
    let frames: [PoseFrame]
    let status: AnalysisStage
    let createdAt: String
}

enum QualityReasonCode: String, Codable, CaseIterable, Sendable {
    case noPerson = "no-person"
    case multiplePeople = "multiple-people"
    case bodyOutOfFrame = "body-out-of-frame"
    case requiredJointsNotVisible = "required-joints-not-visible"
    case insufficientPoseEvidence = "insufficient-pose-evidence"
    case subjectTooSmall = "subject-too-small"
    case unstablePoseLandmarks = "unstable-pose-landmarks"
    case wrongCameraView = "wrong-camera-view"
    case tooDark = "too-dark"
    case tooBright = "too-bright"
    case lowContrast = "low-contrast"
    case blurred
    case imageTooSmall = "image-too-small"
    case normalisationFailed = "normalisation-failed"
    case imageMemoryFailed = "image-memory-failed"
    case decodeFailed = "decode-failed"
}

struct QualityReason: Codable, Equatable, Sendable {
    let code: QualityReasonCode
    let message: String
}

enum QualityStatus: String, Codable, CaseIterable, Sendable {
    case pass
    case partial
    case fail
}

struct QualityReport: Codable, Equatable, Sendable {
    let status: QualityStatus
    let reasons: [QualityReason]
    let unassessableRegions: [BodyRegion]
    let imageWasResized: Bool?
}

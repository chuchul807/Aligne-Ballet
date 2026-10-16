import Foundation

struct RuleContext {
    let position: PoseName
    let supportingSide: SupportingSide
    let view: ViewType?
    let landmarks: [Landmark]
    let reliability: [LandmarkName: LandmarkReliability]
    let measurements: MeasurementSet

    var workingSide: SupportingSide { supportingSide.opposite }

    func support(_ joint: SideJoint) -> LandmarkName { supportingSide.landmark(joint) }
    func working(_ joint: SideJoint) -> LandmarkName { workingSide.landmark(joint) }
    var workingLeg: [LandmarkName] { [working(.hip), working(.knee), working(.ankle)] }
    var supportingLeg: [LandmarkName] { [support(.hip), support(.knee), support(.ankle)] }
}

struct RuleFinding {
    let evidence: [LandmarkName]
    let annotation: [AnnotationInstruction]
    let direction: String
    let severity: Double
    let assessability: Assessability
    let priority: Priority?

    init(
        evidence: [LandmarkName],
        annotation: [AnnotationInstruction] = [],
        direction: String,
        severity: Double,
        assessability: Assessability = .assessable,
        priority: Priority? = nil
    ) {
        self.evidence = evidence
        self.annotation = annotation
        self.direction = direction
        self.severity = severity
        self.assessability = assessability
        self.priority = priority
    }
}

struct Rule {
    let id: String
    let dedupeKey: String
    let positions: Set<PoseName>
    let supportedViews: Set<ViewType>?
    let requiredMeasurements: [KeyPath<MeasurementSet, PoseMeasurement>]
    let region: BodyRegion
    let priority: Priority
    let evidence: [LandmarkName]
    let evaluate: (RuleContext) -> RuleFinding?

    init(
        id: String,
        dedupeKey: String? = nil,
        positions: Set<PoseName> = Set(PoseName.allCases),
        supportedViews: Set<ViewType>? = nil,
        requiredMeasurements: [KeyPath<MeasurementSet, PoseMeasurement>],
        region: BodyRegion,
        priority: Priority,
        evidence: [LandmarkName],
        evaluate: @escaping (RuleContext) -> RuleFinding?
    ) {
        self.id = id
        self.dedupeKey = dedupeKey ?? id
        self.positions = positions
        self.supportedViews = supportedViews
        self.requiredMeasurements = requiredMeasurements
        self.region = region
        self.priority = priority
        self.evidence = evidence
        self.evaluate = evaluate
    }
}

enum RuleMath {
    static func above(_ value: Double?, _ threshold: Double, denominator: Double? = nil) -> Double? {
        guard let value, value.isFinite, value > threshold else { return nil }
        return (value - threshold) / (denominator ?? max(1 - threshold, threshold))
    }

    static func below(_ value: Double?, _ threshold: Double, denominator: Double? = nil) -> Double? {
        guard let value, value.isFinite, value < threshold else { return nil }
        return (threshold - value) / (denominator ?? threshold)
    }

    static func clamp01(_ value: Double) -> Double { min(1, max(0, value)) }
}

enum RuleAnnotation {
    static func joint(_ id: String, _ name: LandmarkName) -> [AnnotationInstruction] {
        [AnnotationInstruction(observationID: id, type: .joint, joints: [name], dx: nil, dy: nil)]
    }

    static func region(_ id: String, _ names: [LandmarkName]) -> [AnnotationInstruction] {
        [AnnotationInstruction(observationID: id, type: .region, joints: names, dx: nil, dy: nil)]
    }
}

import Foundation
import XCTest
@testable import AligneBallet

final class RuleParityTests: XCTestCase {
    func testEveryRuleMatchesSharedWebFixtureForBothSupportSides() throws {
        let fixture = try ParityFixtureLoader.load()
        let rules = CommonRules.all + ArabesqueRules.all + AttitudeRules.all
            + RetireRules.all + ALaSecondeRules.all + TenduCroiseRules.all
        XCTAssertEqual(fixture.ruleCases.count, rules.count)
        XCTAssertEqual(Set(fixture.ruleCases.map(\.id)).count, rules.count)

        for scenario in fixture.ruleCases {
            let rule = try XCTUnwrap(rules.first { $0.id == scenario.id })
            for side in SupportingSide.allCases {
                let base = try context(position: scenario.position, view: scenario.view, side: side)
                let boundary = try replacing(base, values: scenario.boundary)
                let triggered = try replacing(base, values: scenario.trigger)
                let atBoundary = RuleEngine.evaluate(rules: [rule], context: boundary)
                XCTAssertFalse(atBoundary.contains { $0.ruleID == scenario.id }, "\(scenario.id).\(side).boundary")

                let actual = try XCTUnwrap(
                    RuleEngine.evaluate(rules: [rule], context: triggered).first,
                    "\(scenario.id).\(side).trigger"
                )
                XCTAssertEqual(actual.ruleID, scenario.id)
                XCTAssertEqual(actual.dedupeKey, scenario.dedupeKey ?? scenario.id)
                XCTAssertEqual(actual.region, scenario.region)
                XCTAssertEqual(actual.priority, scenario.priority)
                XCTAssertEqual(actual.direction, scenario.direction)
                XCTAssertEqual(actual.assessability, .assessable)
                XCTAssertEqual(actual.confidence, .high)
                XCTAssertGreaterThan(actual.severity ?? 0, 0)

                let medium = try replacing(base, values: scenario.trigger, mediumFirst: true)
                let mediumFinding = try XCTUnwrap(RuleEngine.evaluate(rules: [rule], context: medium).first)
                XCTAssertEqual(mediumFinding.confidence, .medium, "\(scenario.id).\(side).medium")
                XCTAssertTrue(FeedbackComposer.compose(
                    observations: [mediumFinding],
                    coverage: coverage
                ).topCorrections.isEmpty)

                if rule.supportedViews != nil {
                    let wrongView: ViewType = scenario.view == .front ? .threeQuarterSide : .front
                    let unsupported = RuleContext(
                        position: triggered.position,
                        supportingSide: triggered.supportingSide,
                        view: wrongView,
                        landmarks: triggered.landmarks,
                        reliability: triggered.reliability,
                        measurements: triggered.measurements
                    )
                    XCTAssertEqual(
                        RuleEngine.evaluate(rules: [rule], context: unsupported).first?.assessability,
                        .unassessable,
                        "\(scenario.id).\(side).view"
                    )
                }
            }
        }
    }

    func testCommonRulesApplyStrictBoundariesAndStableDirections() throws {
        let baseline = try context(position: .arabesque, view: .front)
        let atBoundary = try replacing(baseline, measurement: "pelvisSlope", value: 8)
        let beyond = try replacing(baseline, measurement: "pelvisSlope", value: 9)

        XCTAssertFalse(RuleEngine.evaluate(rules: CommonRules.all, context: atBoundary)
            .contains { $0.ruleID == "pelvis-unlevel" })
        let finding = RuleEngine.evaluate(rules: CommonRules.all, context: beyond)
            .first { $0.ruleID == "pelvis-unlevel" }
        XCTAssertEqual(finding?.direction, "level the pelvis")
        XCTAssertEqual(finding?.dedupeKey, "pelvis-level")
        XCTAssertEqual(finding?.region, .pelvis)
    }

    func testFivePositionCollectionsHaveStableRules() {
        XCTAssertEqual(ArabesqueRules.all.count, 4)
        XCTAssertEqual(AttitudeRules.all.count, 4)
        XCTAssertEqual(RetireRules.all.count, 2)
        XCTAssertEqual(ALaSecondeRules.all.count, 5)
        XCTAssertEqual(TenduCroiseRules.all.count, 4)
    }

    func testSecondPositionCommonAlignmentUsesLinePriority() throws {
        let base = try context(position: .aLaSeconde, view: .front)
        let triggered = try replacing(base, values: [
            "torsoLateralOffset": 0.29,
            "frontalSupportingHipAnkleOffset": 0.36,
        ])
        let findings = RuleEngine.evaluate(rules: CommonRules.all, context: triggered)
        XCTAssertEqual(findings.first { $0.ruleID == "torso-off-support" }?.priority, .line)
        XCTAssertEqual(findings.first { $0.ruleID == "supporting-lateral-offset" }?.priority, .line)
    }

    func testUnsupportedViewAndMissingMeasurementsAreUnassessable() throws {
        let side = try context(position: .retirePasse, view: .threeQuarterSide)
        let unsupported = RuleEngine.evaluate(rules: RetireRules.all, context: side)
            .first { $0.ruleID == "retire-open-working-knee" }
        XCTAssertEqual(unsupported?.assessability, .unassessable)
        XCTAssertEqual(unsupported?.confidence, .low)

        let base = try context(position: .arabesque, view: .front)
        let missing = try replacing(base, measurement: "pelvisSlope", value: nil)
        let unavailable = RuleEngine.evaluate(rules: CommonRules.all, context: missing)
            .first { $0.ruleID == "pelvis-unlevel" }
        XCTAssertEqual(unavailable?.assessability, .unassessable)
    }

    func testLowConfidenceFindingIsSuppressedByFeedback() throws {
        let base = try context(position: .arabesque, view: .front)
        let medium = try replacing(base, measurement: "pelvisSlope", value: 12, confidence: .medium)
        let observations = RuleEngine.evaluate(rules: CommonRules.all, context: medium)
        let summary = FeedbackComposer.compose(observations: observations, coverage: coverage)

        XCTAssertEqual(observations.first { $0.ruleID == "pelvis-unlevel" }?.confidence, .medium)
        XCTAssertFalse(summary.topCorrections.contains { $0.ruleID == "pelvis-unlevel" })
    }

    private var coverage: [BodyRegion: Assessability] {
        Dictionary(uniqueKeysWithValues: BodyRegion.allCases.map { ($0, .assessable) })
    }

    private func context(
        position: PoseName,
        view: ViewType,
        side: SupportingSide = .left
    ) throws -> RuleContext {
        let fixture = try ParityFixtureLoader.load()
        let sample = try XCTUnwrap(fixture.measurementCases.first { $0.view == view && $0.supportingSide == .left })
        let landmarks: [Landmark] = fixture.baseLandmarks.map { point in
            guard side == .right else { return point }
            let raw = point.name.rawValue
            let mirroredName = raw.hasPrefix("left_")
                ? raw.replacingOccurrences(of: "left_", with: "right_")
                : raw.hasPrefix("right_")
                    ? raw.replacingOccurrences(of: "right_", with: "left_")
                    : raw
            return Landmark(
                name: LandmarkName(rawValue: mirroredName)!,
                x: 1 - point.x,
                y: point.y,
                z: point.z,
                visibility: point.visibility,
                presence: point.presence
            )
        }
        let reliability = ParityFixtureLoader.reliability(for: landmarks)
        return RuleContext(
            position: position,
            supportingSide: side,
            view: view,
            landmarks: landmarks,
            reliability: reliability,
            measurements: PoseMeasurer.measure(
                landmarks: landmarks,
                supportingSide: side,
                reliability: reliability,
                view: view,
                sourceSize: sample.sourceSize
            )
        )
    }

    private func replacing(
        _ context: RuleContext,
        measurement name: String,
        value: Double?,
        confidence: Confidence = .high
    ) throws -> RuleContext {
        try replacing(context, values: [name: value].compactMapValues { $0 }, nilNames: value == nil ? [name] : [], mediumFirst: confidence == .medium)
    }

    private func replacing(
        _ context: RuleContext,
        values: [String: Double],
        nilNames: Set<String> = [],
        mediumFirst: Bool = false
    ) throws -> RuleContext {
        let data = try JSONEncoder().encode(context.measurements)
        var object = try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
        for (index, name) in values.keys.sorted().enumerated() {
            var measurement = try XCTUnwrap(object[name] as? [String: Any])
            measurement["value"] = values[name]!
            measurement["confidence"] = mediumFirst && index == 0 ? "medium" : "high"
            measurement["assessability"] = "assessable"
            object[name] = measurement
        }
        for name in nilNames {
            var measurement = try XCTUnwrap(object[name] as? [String: Any])
            measurement["value"] = NSNull()
            measurement["assessability"] = "unassessable"
            object[name] = measurement
        }
        let modified = try JSONSerialization.data(withJSONObject: object)
        return RuleContext(
            position: context.position,
            supportingSide: context.supportingSide,
            view: context.view,
            landmarks: context.landmarks,
            reliability: context.reliability,
            measurements: try JSONDecoder().decode(MeasurementSet.self, from: modified)
        )
    }
}

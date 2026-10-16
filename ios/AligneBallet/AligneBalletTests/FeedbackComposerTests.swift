import XCTest
@testable import AligneBallet

final class FeedbackComposerTests: XCTestCase {
    func testEveryRuleHasApprovedFeedbackCopyAndStableKeys() {
        let rules = CommonRules.all + ArabesqueRules.all + AttitudeRules.all
            + RetireRules.all + ALaSecondeRules.all + TenduCroiseRules.all
        for rule in rules {
            XCTAssertNotNil(FeedbackCopy.english(ruleID: rule.id, confidence: .high), rule.id)
            XCTAssertNotNil(FeedbackCopy.english(ruleID: rule.id, confidence: .medium), rule.id)
            XCTAssertEqual(
                FeedbackCopy.key(ruleID: rule.id, confidence: .high),
                "feedback.\(rule.id).high"
            )
        }
    }

    func testDeduplicationKeepsHighestPriorityFinding() {
        let first = observation(id: "pelvis-unlevel", dedupe: "same", priority: .line, severity: 0.9)
        let second = observation(id: "supporting-knee-bent", dedupe: "same", priority: .stability, severity: 0.1)

        let summary = FeedbackComposer.compose(observations: [first, second], coverage: coverage)

        XCTAssertEqual(summary.topCorrections.map(\.ruleID), ["supporting-knee-bent"])
    }

    func testFewerThanThreeCorrectionsIsValid() {
        let finding = observation(id: "supporting-knee-bent", dedupe: "knee", priority: .stability, severity: 0.8)

        let summary = FeedbackComposer.compose(observations: [finding], coverage: coverage)

        XCTAssertEqual(summary.topCorrections.count, 1)
        XCTAssertEqual(summary.fullBodyReview.count, BodyRegion.allCases.count)
    }

    func testTopThreeUsesPriorityThenSeverityAndOmitsFourth() {
        let findings = [
            observation(id: "left-arm-line-collapsed", dedupe: "arm", priority: .line, severity: 0.95),
            observation(id: "pelvis-unlevel", dedupe: "pelvis", priority: .structure, severity: 0.2),
            observation(id: "supporting-knee-bent", dedupe: "knee", priority: .stability, severity: 0.1),
            observation(id: "torso-off-support", dedupe: "torso", priority: .stability, severity: 0.8),
        ]

        let summary = FeedbackComposer.compose(observations: findings, coverage: coverage)

        XCTAssertEqual(summary.topCorrections.map(\.ruleID), [
            "torso-off-support", "supporting-knee-bent", "pelvis-unlevel",
        ])
    }

    func testUnassessableRegionSuppressesCorrection() {
        var unavailable = coverage
        unavailable[.supportingLeg] = .unassessable

        let summary = FeedbackComposer.compose(
            observations: [observation(
                id: "supporting-knee-bent",
                dedupe: "knee",
                priority: .stability,
                severity: 0.8
            )],
            coverage: unavailable
        )

        XCTAssertTrue(summary.topCorrections.isEmpty)
        XCTAssertEqual(summary.fullBodyReview.first { $0.region == .supportingLeg }?.status, .unassessable)
    }

    private var coverage: [BodyRegion: Assessability] {
        Dictionary(uniqueKeysWithValues: BodyRegion.allCases.map { ($0, .assessable) })
    }

    private func observation(id: String, dedupe: String, priority: Priority, severity: Double) -> Observation {
        Observation(
            id: id,
            ruleID: id,
            dedupeKey: dedupe,
            region: .supportingLeg,
            priority: priority,
            confidence: .high,
            evidence: [],
            annotation: [],
            assessability: .assessable,
            issue: nil,
            action: nil,
            direction: "lengthen the supporting leg",
            severity: severity
        )
    }
}

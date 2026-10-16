import XCTest
@testable import AligneBallet

final class AnnotationCommandBuilderTests: XCTestCase {
    func testNoCorrectionsStillDrawsReliableStructure() {
        let landmarks = TestLandmarkFactory.person()
        let commands = AnnotationCommandBuilder.build(
            observations: [], landmarks: landmarks,
            reliability: ParityFixtureLoader.reliability(for: landmarks), supportingSide: .left
        )

        XCTAssertTrue(commands.contains(.structuralJoint(joint: .leftKnee)))
        XCTAssertTrue(commands.contains(.skeletonSegment(from: .leftHip, to: .leftKnee)))
        XCTAssertFalse(commands.contains { $0.label != nil })
    }

    func testUnreliableJointAndAttachedSegmentsAreSuppressed() {
        let landmarks = TestLandmarkFactory.person()
        var reliability = ParityFixtureLoader.reliability(for: landmarks)
        reliability[.leftKnee] = LandmarkReliability(
            name: .leftKnee, confidence: .low,
            assessability: .unassessable, reasons: [.crossPassDisagreement]
        )
        let commands = AnnotationCommandBuilder.build(
            observations: [finding("knee", joint: .leftKnee)], landmarks: landmarks,
            reliability: reliability, supportingSide: .left
        )

        XCTAssertFalse(commands.contains(.structuralJoint(joint: .leftKnee)))
        XCTAssertFalse(commands.contains { command in
            if case let .skeletonSegment(from, to) = command {
                return from == .leftKnee || to == .leftKnee
            }
            return false
        })
        XCTAssertFalse(commands.contains { $0.label != nil })
    }

    func testSelectedObservationsKeepOneToOneLabelsAndArrows() {
        let landmarks = TestLandmarkFactory.person()
        let observations = [
            finding("one", joint: .leftKnee),
            finding("two", joint: .rightKnee),
            finding("three", joint: .leftAnkle),
            finding("four", joint: .rightAnkle),
        ]
        let commands = AnnotationCommandBuilder.build(
            observations: observations, landmarks: landmarks,
            reliability: ParityFixtureLoader.reliability(for: landmarks), supportingSide: .left
        )

        XCTAssertEqual(commands.compactMap(\.label), [1, 1, 2, 2, 3, 3])
        XCTAssertTrue(commands.contains(.directionArrow(
            observationID: "one", anchor: .leftKnee, dx: 0, dy: -0.12, label: 1
        )))
        XCTAssertFalse(commands.contains { $0.observationID == "four" })
    }

    private func finding(_ id: String, joint: LandmarkName) -> Observation {
        Observation(
            id: id, ruleID: "supporting-knee-bent", dedupeKey: id,
            region: .supportingLeg, priority: .stability,
            confidence: .high, evidence: [joint], annotation: [
                AnnotationInstruction(observationID: id, type: .joint, joints: [joint], dx: nil, dy: nil),
                AnnotationInstruction(observationID: id, type: .arrow, joints: [joint], dx: 0, dy: -0.12),
            ], assessability: .assessable, issue: nil, action: nil,
            direction: "lengthen the supporting leg", severity: 0.5
        )
    }
}

private extension DrawingCommand {
    var label: Int? {
        switch self {
        case .highlightJoint(_, _, let label), .highlightRegion(_, _, let label),
             .directionArrow(_, _, _, _, let label): label
        default: nil
        }
    }

    var observationID: String? {
        switch self {
        case .highlightJoint(let id, _, _), .highlightRegion(let id, _, _),
             .directionArrow(let id, _, _, _, _): id
        default: nil
        }
    }
}

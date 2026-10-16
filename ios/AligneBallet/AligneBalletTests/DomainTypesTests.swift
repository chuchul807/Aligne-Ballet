import XCTest
@testable import AligneBallet

final class DomainTypesTests: XCTestCase {
    func testLandmarkDecodesAllThirtyThreeNames() throws {
        let rawNames = [
            "nose",
            "left_eye_inner", "left_eye", "left_eye_outer",
            "right_eye_inner", "right_eye", "right_eye_outer",
            "left_ear", "right_ear", "mouth_left", "mouth_right",
            "left_shoulder", "right_shoulder", "left_elbow", "right_elbow",
            "left_wrist", "right_wrist", "left_pinky", "right_pinky",
            "left_index", "right_index", "left_thumb", "right_thumb",
            "left_hip", "right_hip", "left_knee", "right_knee",
            "left_ankle", "right_ankle", "left_heel", "right_heel",
            "left_foot_index", "right_foot_index",
        ]
        let data = try JSONEncoder().encode(rawNames)

        let decoded = try JSONDecoder().decode([LandmarkName].self, from: data)

        XCTAssertEqual(decoded, LandmarkName.allCases)
        XCTAssertEqual(decoded.count, 33)
    }

    func testAnalysisResultRoundTripsThroughJSON() throws {
        let landmark = Landmark(
            name: .leftShoulder,
            x: 0.25,
            y: 0.40,
            z: -0.05,
            visibility: 0.98,
            presence: 0.97
        )
        let correction = CorrectionFeedbackItem(
            observationID: "supporting-knee-bent",
            text: "Lengthen the supporting knee.",
            region: .supportingLeg,
            priority: .stability,
            confidence: .high,
            ruleID: "supporting-knee-bent",
            direction: "straighten"
        )
        let result = AnalysisResult(
            sessionID: "session-1",
            position: .arabesque,
            landmarks: [landmark],
            topCorrections: [correction],
            fullBodyReview: [
                FullBodySection(region: .supportingLeg, status: .finding, items: [correction.feedbackItem])
            ],
            annotations: [
                .highlightJoint(
                    observationID: "supporting-knee-bent",
                    joint: .leftKnee,
                    label: 1
                )
            ],
            createdAt: "2026-10-15T12:00:00Z"
        )

        let data = try JSONEncoder().encode(result)
        let decoded = try JSONDecoder().decode(AnalysisResult.self, from: data)

        XCTAssertEqual(decoded, result)
    }

    func testUnassessableObservationClearsFindingFields() {
        let observation = Observation(
            id: "missing-knee",
            ruleID: "supporting-knee-bent",
            dedupeKey: "supporting-knee",
            region: .supportingLeg,
            priority: .stability,
            confidence: .high,
            evidence: [.leftKnee],
            annotation: [],
            assessability: .unassessable,
            issue: "Should be discarded",
            action: "Should be discarded",
            direction: "straighten",
            severity: 0.9
        )

        XCTAssertEqual(observation.confidence, .low)
        XCTAssertNil(observation.issue)
        XCTAssertNil(observation.action)
        XCTAssertNil(observation.direction)
        XCTAssertNil(observation.severity)
    }
}

import XCTest
@testable import AligneBallet

final class LandmarkReliabilityTests: XCTestCase {
    func testVisiblePlausibleChainIsAssessable() {
        let result = LandmarkReliabilityEvaluator.evaluate(
            landmarks: TestLandmarkFactory.person(),
            view: .front,
            disagreements: []
        )

        XCTAssertEqual(result[.leftKnee]?.assessability, .assessable)
        XCTAssertEqual(result[.leftKnee]?.confidence, .high)
        XCTAssertEqual(result[.leftKnee]?.reasons, [])
    }

    func testVisibilityAndPresenceUseExactPointSixBoundary() {
        let boundary = TestLandmarkFactory.update(
            TestLandmarkFactory.person(),
            .leftKnee,
            visibility: 0.60,
            presence: .some(0.60)
        )
        let below = TestLandmarkFactory.update(
            TestLandmarkFactory.person(),
            .leftKnee,
            visibility: 0.59,
            presence: .some(0.59)
        )

        XCTAssertEqual(
            LandmarkReliabilityEvaluator.evaluate(landmarks: boundary, view: .front)[.leftKnee]?.confidence,
            .medium
        )
        XCTAssertEqual(
            Set(LandmarkReliabilityEvaluator.evaluate(landmarks: below, view: .front)[.leftKnee]?.reasons ?? []),
            Set([.lowVisibility, .lowPresence])
        )
    }

    func testOutOfFrameDisagreementAndImplausibleChainAreRejected() {
        var person = TestLandmarkFactory.update(TestLandmarkFactory.person(), .leftWrist, x: 0.01)
        person = TestLandmarkFactory.update(person, .leftKnee, x: 0.95)
        let result = LandmarkReliabilityEvaluator.evaluate(
            landmarks: person,
            view: .threeQuarterSide,
            disagreements: [.rightAnkle]
        )

        XCTAssertTrue(result[.leftWrist]?.reasons.contains(.outsideFrame) == true)
        XCTAssertTrue(result[.leftKnee]?.reasons.contains(.implausibleChain) == true)
        XCTAssertTrue(result[.rightAnkle]?.reasons.contains(.crossPassDisagreement) == true)
    }

    func testOverlappingSameJointSidesAreMarkedAsPossibleOcclusion() {
        let right = TestLandmarkFactory.person().first { $0.name == .rightWrist }!
        let overlapped = TestLandmarkFactory.update(
            TestLandmarkFactory.person(),
            .leftWrist,
            x: right.x,
            y: right.y
        )

        let result = LandmarkReliabilityEvaluator.evaluate(
            landmarks: overlapped,
            view: .threeQuarterSide
        )

        XCTAssertTrue(result[.leftWrist]?.reasons.contains(.possibleOcclusion) == true)
        XCTAssertTrue(result[.rightWrist]?.reasons.contains(.possibleOcclusion) == true)
        XCTAssertEqual(result[.leftHip]?.assessability, .assessable)
    }
}

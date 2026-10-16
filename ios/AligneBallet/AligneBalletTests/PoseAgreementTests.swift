import XCTest
@testable import AligneBallet

final class PoseAgreementTests: XCTestCase {
    func testMajorAndFlexibleJointsUseDifferentTorsoThresholds() {
        let whole = TestLandmarkFactory.person()
        let knee = TestLandmarkFactory.update(whole, .leftKnee, x: 0.449)
        let wrist = TestLandmarkFactory.update(whole, .leftWrist, x: 0.270)

        XCTAssertTrue(PoseAgreement.compare(whole: whole, refined: knee, sourceSize: size).contains(.leftKnee))
        XCTAssertFalse(PoseAgreement.compare(whole: whole, refined: wrist, sourceSize: size).contains(.leftWrist))
    }

    func testMissingAndLowConfidenceCrossPassEvidenceIsUnstable() {
        let refined = TestLandmarkFactory.person()
        let missing = refined.filter { $0.name != .rightHip }
        let lowVisibility = TestLandmarkFactory.update(refined, .rightHip, visibility: 0.59)

        XCTAssertTrue(PoseAgreement.compare(whole: missing, refined: refined, sourceSize: size).contains(.rightHip))
        XCTAssertTrue(PoseAgreement.compare(whole: lowVisibility, refined: refined, sourceSize: size).contains(.rightHip))
    }

    func testDepthOrderFlipMarksFootAndKneeUnstable() {
        var whole = withDepth(heel: -0.04, toe: 0.04, knee: -0.05)
        var refined = withDepth(heel: 0.04, toe: -0.04, knee: 0.05)
        whole = TestLandmarkFactory.update(whole, .leftHeel, z: .some(-0.04))
        refined = TestLandmarkFactory.update(refined, .leftHeel, z: .some(0.04))

        let unstable = PoseAgreement.compare(whole: whole, refined: refined, sourceSize: size)

        XCTAssertTrue(unstable.contains(.rightHeel))
        XCTAssertTrue(unstable.contains(.rightFootIndex))
        XCTAssertTrue(unstable.contains(.leftKnee))
    }

    private let size = PixelSize(width: 1000, height: 1000)

    private func withDepth(heel: Double, toe: Double, knee: Double) -> [Landmark] {
        TestLandmarkFactory.person().map { point in
            Landmark(
                name: point.name,
                x: point.x,
                y: point.y,
                z: point.name == .rightHeel ? heel : point.name == .rightFootIndex ? toe : point.name == .leftKnee ? knee : 0,
                visibility: point.visibility
            )
        }
    }
}

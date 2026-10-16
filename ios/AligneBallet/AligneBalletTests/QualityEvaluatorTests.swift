import XCTest
@testable import AligneBallet

final class QualityEvaluatorTests: XCTestCase {
    func testZeroAndMultiplePeopleFailWithStableCodes() {
        let zero = QualityEvaluator.evaluate(input(people: []))
        let multiple = QualityEvaluator.evaluate(input(people: [person(), person()]))

        XCTAssertEqual(zero.status, .fail)
        XCTAssertTrue(zero.reasons.map(\.code).contains(.noPerson))
        XCTAssertEqual(multiple.status, .fail)
        XCTAssertTrue(multiple.reasons.map(\.code).contains(.multiplePeople))
    }

    func testOutOfFrameLowVisibilityAndWrongViewFail() {
        var invalid = TestLandmarkFactory.update(person(), .leftFootIndex, x: 0.01)
        invalid = TestLandmarkFactory.update(invalid, .leftKnee, visibility: 0.59)
        invalid = TestLandmarkFactory.update(invalid, .leftShoulder, x: 0.47)
        invalid = TestLandmarkFactory.update(invalid, .rightShoulder, x: 0.53)
        invalid = TestLandmarkFactory.update(invalid, .leftHip, x: 0.48)
        invalid = TestLandmarkFactory.update(invalid, .rightHip, x: 0.52)

        let report = QualityEvaluator.evaluate(input(people: [invalid]))
        let codes = Set(report.reasons.map(\.code))

        XCTAssertEqual(report.status, .fail)
        XCTAssertTrue(codes.contains(.bodyOutOfFrame))
        XCTAssertTrue(codes.contains(.requiredJointsNotVisible))
        XCTAssertTrue(codes.contains(.wrongCameraView))
    }

    func testDarkLowContrastBlurredImageReturnsAllImageReasons() {
        let report = QualityEvaluator.evaluate(input(
            people: [person()],
            metrics: ImageMetrics(meanLuminance: 0.05, contrast: 0.01, edgeEnergy: 0.01)
        ))

        XCTAssertEqual(report.reasons.map(\.code), [.tooDark, .lowContrast, .blurred])
    }

    func testOptionalArmEvidenceProducesPartialReport() {
        var partial = TestLandmarkFactory.update(person(), .leftElbow, visibility: 0.2)
        partial = TestLandmarkFactory.update(partial, .rightWrist, visibility: 0.2)

        XCTAssertEqual(
            QualityEvaluator.evaluate(input(people: [partial])),
            QualityReport(
                status: .partial,
                reasons: [],
                unassessableRegions: [.shouldersArms],
                imageWasResized: nil
            )
        )
    }

    func testVisibleWellLitFullBodyPasses() {
        XCTAssertEqual(
            QualityEvaluator.evaluate(input(people: [person()])),
            QualityReport(status: .pass, reasons: [], unassessableRegions: [], imageWasResized: nil)
        )
    }

    private func person() -> [Landmark] {
        TestLandmarkFactory.person()
    }

    private func input(
        people: [[Landmark]],
        metrics: ImageMetrics = ImageMetrics(meanLuminance: 0.5, contrast: 0.2, edgeEnergy: 0.1)
    ) -> QualityInput {
        QualityInput(
            landmarks: LandmarkSet(people: people, sourceWidth: 1000, sourceHeight: 1400),
            position: .arabesque,
            supportingSide: .left,
            expectedView: .threeQuarterSide,
            metrics: metrics
        )
    }
}

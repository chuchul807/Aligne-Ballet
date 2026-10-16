import XCTest
@testable import AligneBallet

final class ImageMetricsTests: XCTestCase {
    func testNormalSyntheticPixelsMatchWebMetrics() throws {
        let image = TestImageFactory.image(width: 2, height: 2) { x, _ in
            x == 0 ? (0, 0, 0, 255) : (255, 255, 255, 255)
        }

        let metrics = try ImageMetricsCalculator.calculate(image: image)

        XCTAssertEqual(metrics.meanLuminance, 0.5, accuracy: 0.000001)
        XCTAssertEqual(metrics.contrast, 0.5, accuracy: 0.000001)
        XCTAssertEqual(metrics.edgeEnergy, 0.5, accuracy: 0.000001)
    }

    func testSolidImageHasNoArtificialContrastOrSharpness() throws {
        let image = TestImageFactory.solid(width: 2, height: 2, value: 128)

        let metrics = try ImageMetricsCalculator.calculate(image: image)

        XCTAssertEqual(metrics.meanLuminance, 128.0 / 255.0, accuracy: 0.000001)
        XCTAssertEqual(metrics.contrast, 0, accuracy: 0.000001)
        XCTAssertEqual(metrics.edgeEnergy, 0, accuracy: 0.000001)
    }

    func testDarkImageReportsLowLuminance() throws {
        let metrics = try ImageMetricsCalculator.calculate(
            image: TestImageFactory.solid(width: 8, height: 8, value: 10)
        )

        XCTAssertEqual(metrics.meanLuminance, 10.0 / 255.0, accuracy: 0.000001)
        XCTAssertLessThan(metrics.meanLuminance, 0.08)
    }

    func testLowContrastImageReportsSmallStandardDeviation() throws {
        let image = TestImageFactory.image(width: 4, height: 4) { x, _ in
            let value: UInt8 = x.isMultiple(of: 2) ? 120 : 124
            return (value, value, value, 255)
        }

        let metrics = try ImageMetricsCalculator.calculate(image: image)

        XCTAssertLessThan(metrics.contrast, 0.01)
        XCTAssertLessThan(metrics.edgeEnergy, 0.02)
    }
}

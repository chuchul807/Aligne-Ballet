import CoreGraphics
import UniformTypeIdentifiers
import XCTest
@testable import AligneBallet

final class ImageNormalizerTests: XCTestCase {
    func testRejectsShortestSideBelow480() {
        let data = TestImageFactory.encoded(TestImageFactory.solid(width: 479, height: 960))

        XCTAssertThrowsError(try ImageNormalizer().normalize(data: data)) { error in
            XCTAssertEqual((error as? ImageInputError)?.code, .imageTooSmall)
            XCTAssertEqual((error as? ImageInputError)?.localizedKey, "image.error.too-small")
        }
    }

    func testResizesLongestSideAbove4096WithoutUpscaling() throws {
        let oversized = TestImageFactory.encoded(TestImageFactory.solid(width: 5000, height: 480))
        let normal = TestImageFactory.encoded(TestImageFactory.solid(width: 640, height: 960))

        let resized = try ImageNormalizer().normalize(data: oversized)
        let unchanged = try ImageNormalizer().normalize(data: normal)

        XCTAssertEqual(resized.originalSize, PixelSize(width: 5000, height: 480))
        XCTAssertEqual(PixelSize(width: resized.cgImage.width, height: resized.cgImage.height), PixelSize(width: 4096, height: 393))
        XCTAssertTrue(resized.wasResized)
        XCTAssertEqual(unchanged.originalSize, PixelSize(width: 640, height: 960))
        XCTAssertEqual(PixelSize(width: unchanged.cgImage.width, height: unchanged.cgImage.height), PixelSize(width: 640, height: 960))
        XCTAssertFalse(unchanged.wasResized)
    }

    func testAppliesEXIFRightRotationBeforeReportingSize() throws {
        let source = TestImageFactory.image(width: 480, height: 640) { _, y in
            y < 320 ? (255, 0, 0, 255) : (0, 0, 255, 255)
        }
        let data = TestImageFactory.encoded(source, type: .jpeg, orientation: .right)

        let normalized = try ImageNormalizer().normalize(data: data)

        XCTAssertEqual(normalized.originalSize, PixelSize(width: 640, height: 480))
        XCTAssertEqual(normalized.cgImage.width, 640)
        XCTAssertEqual(normalized.cgImage.height, 480)
    }

    func testRemovesMirroredOrientationFromPixelSpace() throws {
        let source = TestImageFactory.image(width: 480, height: 640) { x, _ in
            x < 240 ? (255, 0, 0, 255) : (0, 0, 255, 255)
        }
        let data = TestImageFactory.encoded(source, type: .jpeg, orientation: .upMirrored)

        let normalized = try ImageNormalizer().normalize(data: data)
        let left = TestImageFactory.pixel(normalized.cgImage, x: 40, y: 320)
        let right = TestImageFactory.pixel(normalized.cgImage, x: 440, y: 320)

        XCTAssertGreaterThan(left.blue, left.red)
        XCTAssertGreaterThan(right.red, right.blue)
    }

    func testRejectsInvalidData() {
        XCTAssertThrowsError(try ImageNormalizer().normalize(data: Data("not an image".utf8))) { error in
            XCTAssertEqual((error as? ImageInputError)?.code, .decodeFailed)
            XCTAssertEqual((error as? ImageInputError)?.localizedKey, "image.error.decode")
        }
    }

    func testMapsRendererAllocationFailureWithoutRetainingInput() throws {
        let renderer = AllocationFailingRenderer()
        let normalizer = ImageNormalizer(renderer: renderer)
        let data = TestImageFactory.encoded(TestImageFactory.solid(width: 5000, height: 480))

        try autoreleasepool { () -> Void in
            XCTAssertThrowsError(try normalizer.normalize(data: data)) { error in
                XCTAssertEqual((error as? ImageInputError)?.code, .imageMemoryFailed)
                XCTAssertEqual((error as? ImageInputError)?.localizedKey, "image.error.memory")
            }
        }

        XCTAssertNil(renderer.decodedImage)
    }
}

private final class AllocationFailingRenderer: ImageNormalizingRenderer {
    weak var decodedImage: CGImage?

    func render(
        image: CGImage,
        orientation: CGImagePropertyOrientation,
        targetSize: PixelSize
    ) throws -> CGImage {
        decodedImage = image
        throw ImageRenderError.allocationFailed
    }
}

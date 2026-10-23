import UIKit
import XCTest
@testable import AligneBallet

final class AnnotationRendererTests: XCTestCase {
    func testRendererPreservesBaseImageTopBottomPixelOrientation() throws {
        let base = TestImageFactory.image(width: 800, height: 1200) { _, y in
            y < 600 ? (255, 0, 0, 255) : (0, 0, 255, 255)
        }
        let rendered = try AnnotationRenderer.render(baseImage: base, commands: [], landmarks: [])
        let image = try XCTUnwrap(rendered.cgImage)

        for y in [200, 1000] {
            let before = TestImageFactory.pixel(base, x: 200, y: y)
            let after = TestImageFactory.pixel(image, x: 200, y: y)
            XCTAssertEqual(after.red, before.red)
            XCTAssertEqual(after.blue, before.blue)
        }
    }

    func testRendererKeepsPixelSizeAndDoesNotModifySource() throws {
        let base = TestImageFactory.solid(width: 800, height: 1200)
        let point = Landmark(name: .leftKnee, x: 0.25, y: 0.75, visibility: 1)
        let sourceBefore = TestImageFactory.pixel(base, x: 200, y: 300)

        let rendered = try AnnotationRenderer.render(
            baseImage: base,
            commands: [.highlightJoint(observationID: "knee", joint: .leftKnee, label: 1)],
            landmarks: [point]
        )

        XCTAssertEqual(rendered.cgImage?.width, 800)
        XCTAssertEqual(rendered.cgImage?.height, 1200)
        XCTAssertEqual(TestImageFactory.pixel(base, x: 200, y: 300).red, sourceBefore.red)
        let marked = TestImageFactory.pixel(try XCTUnwrap(rendered.cgImage), x: 200, y: 300)
        XCTAssertNotEqual(marked.red, sourceBefore.red)
    }

    func testPortraitCoordinatesStayAlignedWithUprightImage() throws {
        let base = TestImageFactory.solid(width: 800, height: 1200)
        let point = Landmark(name: .leftKnee, x: 0.25, y: 0.75, visibility: 1)
        let rendered = try AnnotationRenderer.render(
            baseImage: base,
            commands: [.structuralJoint(joint: .leftKnee)],
            landmarks: [point]
        )
        let image = try XCTUnwrap(rendered.cgImage)

        // The pixel reader flips rows relative to the UIKit-rendered image.
        let visualLower = TestImageFactory.pixel(image, x: 200, y: 300)
        let visualUpper = TestImageFactory.pixel(image, x: 200, y: 900)
        XCTAssertNotEqual(visualLower.red, 128)
        XCTAssertEqual(visualUpper.red, 128)
    }

    func testTopLandmarkAppearsAtVisualTopOfRenderedPhoto() throws {
        let base = TestImageFactory.solid(width: 800, height: 1200)
        let point = Landmark(name: .nose, x: 0.5, y: 0.2, visibility: 1)
        let rendered = try AnnotationRenderer.render(
            baseImage: base,
            commands: [.structuralJoint(joint: .nose)],
            landmarks: [point]
        )
        let image = try XCTUnwrap(rendered.cgImage)

        // TestImageFactory.pixel uses a flipped CGContext when reading a CGImage.
        // Its row 960 corresponds to visual row 240 in the UIKit-rendered image.
        let visualTop = TestImageFactory.pixel(image, x: 400, y: 960)
        let visualBottom = TestImageFactory.pixel(image, x: 400, y: 240)
        XCTAssertNotEqual(visualTop.red, 128)
        XCTAssertEqual(visualBottom.red, 128)
    }

    func testPositiveArrowDyPointsTowardVisualBottom() throws {
        let base = TestImageFactory.solid(width: 800, height: 1200)
        let anchor = Landmark(name: .nose, x: 0.5, y: 0.5, visibility: 1)
        let rendered = try AnnotationRenderer.render(
            baseImage: base,
            commands: [
                .directionArrow(
                    observationID: "direction",
                    anchor: .nose,
                    dx: 0,
                    dy: 0.2,
                    label: 1
                ),
            ],
            landmarks: [anchor]
        )
        let image = try XCTUnwrap(rendered.cgImage)

        // The pixel reader's row order is opposite UIKit's visual row order.
        let belowAnchor = TestImageFactory.pixel(image, x: 400, y: 450)
        let aboveAnchor = TestImageFactory.pixel(image, x: 400, y: 750)
        XCTAssertNotEqual(belowAnchor.red, 128)
        XCTAssertEqual(aboveAnchor.red, 128)
    }
}

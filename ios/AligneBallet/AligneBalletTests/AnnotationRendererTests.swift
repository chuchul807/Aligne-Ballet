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
        let sourceBefore = TestImageFactory.pixel(base, x: 200, y: 900)

        let rendered = try AnnotationRenderer.render(
            baseImage: base,
            commands: [.highlightJoint(observationID: "knee", joint: .leftKnee, label: 1)],
            landmarks: [point]
        )

        XCTAssertEqual(rendered.cgImage?.width, 800)
        XCTAssertEqual(rendered.cgImage?.height, 1200)
        XCTAssertEqual(TestImageFactory.pixel(base, x: 200, y: 900).red, sourceBefore.red)
        let marked = TestImageFactory.pixel(try XCTUnwrap(rendered.cgImage), x: 200, y: 900)
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

        let lower = TestImageFactory.pixel(image, x: 200, y: 900)
        let upper = TestImageFactory.pixel(image, x: 200, y: 300)
        XCTAssertNotEqual(lower.red, 128)
        XCTAssertEqual(upper.red, 128)
    }
}

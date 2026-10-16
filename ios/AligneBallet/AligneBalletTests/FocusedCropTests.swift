import XCTest
@testable import AligneBallet

final class FocusedCropTests: XCTestCase {
    func testBodyExtentUsesExact180PixelBoundary() {
        let tooSmall = sizedPerson(torsoPixels: 48, extentPixels: 179)
        let usable = sizedPerson(torsoPixels: 48, extentPixels: 180)

        XCTAssertEqual(
            FocusedCrop.assessSubjectSize(landmarks: tooSmall, sourceSize: PixelSize(width: 1024, height: 1024)),
            .tooSmall
        )
        guard case let .usable(torsoPixels, bodyExtentPixels) = FocusedCrop.assessSubjectSize(
            landmarks: usable,
            sourceSize: PixelSize(width: 1024, height: 1024)
        ) else {
            return XCTFail("Expected exact boundary to be usable")
        }
        XCTAssertEqual(torsoPixels, 48, accuracy: 0.000001)
        XCTAssertEqual(bodyExtentPixels, 180, accuracy: 0.000001)
    }

    func testMissingOrLowPresenceStructuralEvidenceIsInsufficient() {
        let person = sizedPerson(torsoPixels: 100, extentPixels: 300)
        let missing = person.filter { $0.name != .leftAnkle }
        let lowPresence = TestLandmarkFactory.update(person, .leftAnkle, presence: .some(0.59))
        let size = PixelSize(width: 1024, height: 1024)

        XCTAssertEqual(FocusedCrop.assessSubjectSize(landmarks: missing, sourceSize: size), .insufficientEvidence)
        XCTAssertEqual(FocusedCrop.assessSubjectSize(landmarks: lowPresence, sourceSize: size), .insufficientEvidence)
    }

    func testFocusRectAddsTwentyPercentPaddingAndClampsToImage() {
        let rect = FocusedCrop.calculateRect(
            landmarks: boxPerson(left: 0.10, top: 0.20, right: 0.80, bottom: 0.90),
            sourceSize: PixelSize(width: 1000, height: 1000)
        )

        XCTAssertEqual(rect, CropRect(left: 0, top: 60, width: 940, height: 940))
    }

    func testMapsCropCoordinatesAndDepthBackToFullImage() {
        let point = Landmark(name: .leftKnee, x: 0.5, y: 0.25, z: 0.2, visibility: 0.9)
        let mapped = FocusedCrop.mapLandmarks(
            [point],
            from: CropRect(left: 200, top: 100, width: 400, height: 800),
            sourceSize: PixelSize(width: 1000, height: 1200)
        )

        XCTAssertEqual(mapped[0].x, 0.4, accuracy: 0.000001)
        XCTAssertEqual(mapped[0].y, 0.25, accuracy: 0.000001)
        XCTAssertEqual(mapped[0].z ?? .nan, 0.08, accuracy: 0.000001)
    }

    func testCropDownscalesLongestSideTo4096() throws {
        let image = TestImageFactory.solid(width: 5000, height: 480)
        let cropped = try FocusedCrop.crop(
            image: image,
            rect: CropRect(left: 0, top: 0, width: 5000, height: 480)
        )

        XCTAssertEqual(cropped.width, 4096)
        XCTAssertEqual(cropped.height, 393)
    }

    private func sizedPerson(torsoPixels: Double, extentPixels: Double) -> [Landmark] {
        let shoulderY = 256.0 / 1024.0
        let hipY = (256.0 + torsoPixels) / 1024.0
        return [
            Landmark(name: .leftShoulder, x: 400.0 / 1024.0, y: shoulderY, visibility: 0.9),
            Landmark(name: .rightShoulder, x: 500.0 / 1024.0, y: shoulderY, visibility: 0.9),
            Landmark(name: .leftHip, x: 400.0 / 1024.0, y: hipY, visibility: 0.9),
            Landmark(name: .rightHip, x: 500.0 / 1024.0, y: hipY, visibility: 0.9),
            Landmark(name: .leftAnkle, x: 450.0 / 1024.0, y: (256.0 + extentPixels) / 1024.0, visibility: 0.9),
        ]
    }

    private func boxPerson(left: Double, top: Double, right: Double, bottom: Double) -> [Landmark] {
        [
            Landmark(name: .leftShoulder, x: left, y: top, visibility: 0.9),
            Landmark(name: .rightShoulder, x: right, y: top, visibility: 0.9),
            Landmark(name: .leftHip, x: left, y: top + (bottom - top) * 0.25, visibility: 0.9),
            Landmark(name: .rightHip, x: right, y: top + (bottom - top) * 0.25, visibility: 0.9),
            Landmark(name: .leftAnkle, x: left, y: bottom, visibility: 0.9),
        ]
    }
}

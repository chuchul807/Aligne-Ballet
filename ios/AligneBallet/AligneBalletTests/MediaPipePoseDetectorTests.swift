import XCTest
@testable import AligneBallet

final class MediaPipePoseDetectorTests: XCTestCase {
    func testMapsAllLandmarksAndKeepsPersonOrder() {
        let first = LandmarkName.allCases.enumerated().map { index, _ in
            PoseLandmarkValue(x: Double(index) / 100, y: 0.4, z: -0.2,
                              visibility: 0.9, presence: 0.8)
        }
        let second = Array(repeating: PoseLandmarkValue(x: 0.7, y: 0.2, z: nil,
                                                         visibility: nil, presence: nil), count: 33)
        let mapped = MediaPipePoseDetector.mapPeople([first, second], width: 1080, height: 1920)
        XCTAssertEqual(mapped.people.count, 2)
        XCTAssertEqual(mapped.people[0].count, 33)
        XCTAssertEqual(mapped.people[0][32].name, .rightFootIndex)
        XCTAssertEqual(mapped.people[0][32].x, 0.32, accuracy: 0.0001)
        XCTAssertEqual(mapped.people[0][0].z, -0.2)
        XCTAssertEqual(mapped.people[0][0].visibility, 0.9)
        XCTAssertEqual(mapped.people[0][0].presence, 0.8)
        XCTAssertEqual(mapped.people[1][0].x, 0.7)
        XCTAssertEqual(mapped.people[1][0].visibility, 0)
        XCTAssertNil(mapped.people[1][0].presence)
        XCTAssertEqual(mapped.sourceWidth, 1080)
        XCTAssertEqual(mapped.sourceHeight, 1920)
        XCTAssertTrue(MediaPipePoseDetector.mapPeople([], width: 100, height: 200).people.isEmpty)
    }

    func testBundledModelLoadsAndBlankImageHasNoPerson() async throws {
        let url = try XCTUnwrap(Bundle.main.url(forResource: "pose_landmarker_heavy", withExtension: "task"))
        let detector = try MediaPipePoseDetector(modelURL: url)
        let output = try await detector.detect(image: TestImageFactory.solid(width: 600, height: 800))
        XCTAssertEqual(output.people.count, 0)
    }

    func testMissingModelThrows() {
        XCTAssertThrowsError(try MediaPipePoseDetector(
            modelURL: URL(fileURLWithPath: "/definitely/missing/pose_landmarker_heavy.task")
        ))
    }
}

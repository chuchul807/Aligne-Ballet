import XCTest
@testable import AligneBallet

final class PhotoSelectionServiceTests: XCTestCase {
    func testCancellationReturnsNil() async throws {
        let service = PhotoSelectionService()
        let data = try await service.loadData(from: nil)
        XCTAssertNil(data)
    }

    func testInvalidDataAndOversizeAreRejected() {
        let service = PhotoSelectionService()
        XCTAssertThrowsError(try service.validate(Data([0, 1, 2]))) { error in
            XCTAssertEqual(error as? ImageInputError, .decodeFailed)
        }
        XCTAssertThrowsError(try service.validate(Data(repeating: 0, count: 12 * 1024 * 1024 + 1))) { error in
            XCTAssertEqual(error as? ImageInputError, .fileTooLarge)
        }
    }

    func testValidImageAccepted() throws {
        let data = TestImageFactory.encoded(TestImageFactory.solid(width: 600, height: 800))
        XCTAssertEqual(try PhotoSelectionService().validate(data), data)
    }
}

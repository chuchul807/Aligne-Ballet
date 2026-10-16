import Photos
import UIKit
import XCTest
@testable import AligneBallet

private final class FakePhotoSaveBackend: PhotoSaveBackend, @unchecked Sendable {
    var status: PHAuthorizationStatus = .notDetermined
    var requestedStatus: PHAuthorizationStatus = .authorized
    var shouldFail = false
    var requestCount = 0
    var saveCount = 0

    func authorizationStatus() -> PHAuthorizationStatus { status }
    func requestAuthorization() async -> PHAuthorizationStatus {
        requestCount += 1
        return requestedStatus
    }
    func save(_ image: UIImage) async throws {
        saveCount += 1
        if shouldFail { throw PhotoSaveError.saveFailed }
    }
}

final class PhotoSaveServiceTests: XCTestCase {
    private let image = UIGraphicsImageRenderer(size: CGSize(width: 16, height: 16))
        .image { context in UIColor.purple.setFill(); context.fill(CGRect(x: 0, y: 0, width: 16, height: 16)) }

    func testAlreadyAuthorizedSavesAnnotatedImageWithoutRequest() async throws {
        let backend = FakePhotoSaveBackend()
        backend.status = .authorized
        try await PhotoSaveService(backend: backend).save(image)
        XCTAssertEqual(backend.saveCount, 1)
        XCTAssertEqual(backend.requestCount, 0)
    }

    func testNotDeterminedRequestsAddOnlyThenSaves() async throws {
        let backend = FakePhotoSaveBackend()
        try await PhotoSaveService(backend: backend).save(image)
        XCTAssertEqual(backend.requestCount, 1)
        XCTAssertEqual(backend.saveCount, 1)
    }

    func testDeniedAndRestrictedNeverSave() async {
        for status in [PHAuthorizationStatus.denied, .restricted] {
            let backend = FakePhotoSaveBackend()
            backend.status = status
            do {
                try await PhotoSaveService(backend: backend).save(image)
                XCTFail("Expected permission denial")
            } catch {
                XCTAssertEqual(error as? PhotoSaveError, .permissionDenied)
            }
            XCTAssertEqual(backend.saveCount, 0)
        }
    }

    func testDeniedAfterPromptNeverSaves() async {
        let backend = FakePhotoSaveBackend()
        backend.requestedStatus = .denied
        do {
            try await PhotoSaveService(backend: backend).save(image)
            XCTFail("Expected permission denial")
        } catch {
            XCTAssertEqual(error as? PhotoSaveError, .permissionDenied)
        }
        XCTAssertEqual(backend.saveCount, 0)
    }

    func testBackendFailureIsReported() async {
        let backend = FakePhotoSaveBackend()
        backend.status = .authorized
        backend.shouldFail = true
        do {
            try await PhotoSaveService(backend: backend).save(image)
            XCTFail("Expected save failure")
        } catch {
            XCTAssertEqual(error as? PhotoSaveError, .saveFailed)
        }
    }
}

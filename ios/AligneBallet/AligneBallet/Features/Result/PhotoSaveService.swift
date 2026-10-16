import Photos
import UIKit

enum PhotoSaveError: Error, Equatable {
    case permissionDenied
    case saveFailed
}

protocol PhotoSaveServing: Sendable {
    func save(_ image: UIImage) async throws
}

protocol PhotoSaveBackend: Sendable {
    func authorizationStatus() -> PHAuthorizationStatus
    func requestAuthorization() async -> PHAuthorizationStatus
    func save(_ image: UIImage) async throws
}

struct SystemPhotoSaveBackend: PhotoSaveBackend {
    func authorizationStatus() -> PHAuthorizationStatus {
        PHPhotoLibrary.authorizationStatus(for: .addOnly)
    }

    func requestAuthorization() async -> PHAuthorizationStatus {
        await PHPhotoLibrary.requestAuthorization(for: .addOnly)
    }

    func save(_ image: UIImage) async throws {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            PHPhotoLibrary.shared().performChanges {
                PHAssetChangeRequest.creationRequestForAsset(from: image)
            } completionHandler: { success, error in
                if success {
                    continuation.resume()
                } else {
                    continuation.resume(throwing: error ?? PhotoSaveError.saveFailed)
                }
            }
        }
    }
}

struct PhotoSaveService: PhotoSaveServing {
    var backend: any PhotoSaveBackend = SystemPhotoSaveBackend()

    func save(_ image: UIImage) async throws {
        let status = backend.authorizationStatus()
        let resolved = status == .notDetermined ? await backend.requestAuthorization() : status
        guard resolved == .authorized || resolved == .limited else {
            throw PhotoSaveError.permissionDenied
        }
        do {
            try await backend.save(image)
        } catch {
            throw PhotoSaveError.saveFailed
        }
    }
}

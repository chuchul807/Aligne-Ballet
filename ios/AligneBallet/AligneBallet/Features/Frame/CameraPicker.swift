import AVFoundation
import SwiftUI
import UIKit

enum CameraPermissionStatus: Equatable {
    case notDetermined
    case authorized
    case denied
    case restricted
    case unavailable
}

protocol CameraAuthorizing {
    var status: CameraPermissionStatus { get }
    func requestAccess() async -> Bool
}

enum CameraAccess {
    static func resolve(using authorizer: any CameraAuthorizing) async -> CameraPermissionStatus {
        let status = authorizer.status
        guard status == .notDetermined else { return status }
        return await authorizer.requestAccess() ? .authorized : .denied
    }
}

struct SystemCameraAuthorizer: CameraAuthorizing {
    var status: CameraPermissionStatus {
        guard UIImagePickerController.isSourceTypeAvailable(.camera) else { return .unavailable }
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized: return .authorized
        case .denied: return .denied
        case .restricted: return .restricted
        case .notDetermined: return .notDetermined
        @unknown default: return .restricted
        }
    }

    func requestAccess() async -> Bool {
        await AVCaptureDevice.requestAccess(for: .video)
    }
}

struct UnavailableTestCameraAuthorizer: CameraAuthorizing {
    let status: CameraPermissionStatus = .unavailable
    func requestAccess() async -> Bool { false }
}

struct CameraPicker: UIViewControllerRepresentable {
    let onImage: (Data) -> Void
    let onCancel: () -> Void

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = .camera
        picker.cameraCaptureMode = .photo
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ controller: UIImagePickerController, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(onImage: onImage, onCancel: onCancel) }

    final class Coordinator: NSObject, UINavigationControllerDelegate, UIImagePickerControllerDelegate {
        let onImage: (Data) -> Void
        let onCancel: () -> Void

        init(onImage: @escaping (Data) -> Void, onCancel: @escaping () -> Void) {
            self.onImage = onImage
            self.onCancel = onCancel
        }

        func imagePickerController(
            _ picker: UIImagePickerController,
            didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]
        ) {
            defer { picker.dismiss(animated: true) }
            guard let image = info[.originalImage] as? UIImage,
                  let data = image.jpegData(compressionQuality: 0.92) else {
                onCancel()
                return
            }
            onImage(data)
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            picker.dismiss(animated: true)
            onCancel()
        }
    }
}

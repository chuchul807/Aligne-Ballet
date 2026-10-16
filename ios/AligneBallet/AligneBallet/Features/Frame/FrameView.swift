import PhotosUI
import SwiftUI
import UIKit

struct FrameView: View {
    @ObservedObject var store: AnalysisSessionStore
    var photoService: any PhotoSelectionServing = PhotoSelectionService()
    var cameraAuthorizer: any CameraAuthorizing = SystemCameraAuthorizer()

    @State private var selectedItem: PhotosPickerItem?
    @State private var showingCamera = false
    @State private var cameraNotice: CameraPermissionStatus?
    @State private var photoError: ImageInputError?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                Text("FRAME YOUR PHOTO")
                    .font(.caption.weight(.bold))
                    .tracking(2)
                    .foregroundStyle(AligneStyle.accent)

                Text("One dancer. Full body. Clear light.")
                    .font(.system(.title, design: .serif, weight: .semibold))
                    .foregroundStyle(AligneStyle.deep)
                    .accessibilityIdentifier("stage.frame.title")

                VStack(alignment: .leading, spacing: 12) {
                    Label("Keep your head, hands and feet inside the photo.", systemImage: "person.crop.rectangle")
                    Label("Only one dancer should be visible.", systemImage: "person")
                    Label(
                        store.expectedView == .front
                            ? "Face the camera for this position."
                            : "Turn to a three-quarter side view.",
                        systemImage: "camera.viewfinder"
                    )
                }
                .font(.body)
                .foregroundStyle(AligneStyle.deep)
                .padding(18)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(AligneStyle.soft, in: RoundedRectangle(cornerRadius: 14))

                Button("Take a photo", systemImage: "camera") {
                    Task { await openCamera() }
                }
                .buttonStyle(PrimaryAligneButtonStyle())
                .accessibilityIdentifier("frame.camera")

                PhotosPicker(selection: $selectedItem, matching: .images) {
                    Label("Choose from Photos", systemImage: "photo.on.rectangle")
                        .font(.headline)
                        .frame(maxWidth: .infinity, minHeight: 48)
                        .foregroundStyle(AligneStyle.deep)
                        .background(AligneStyle.surface,
                                    in: RoundedRectangle(cornerRadius: 12))
                        .overlay(RoundedRectangle(cornerRadius: 12)
                            .stroke(AligneStyle.accent, lineWidth: 1))
                }
                .accessibilityIdentifier("frame.photos")
                .onChange(of: selectedItem) { item in
                    Task { await loadPhoto(item) }
                }

                if ProcessInfo.processInfo.arguments.contains("-aligne-ui-test-photo") {
                    Button("Use sample photo") {
                        acceptPhoto(Self.samplePhoto())
                    }
                    .frame(minHeight: 44)
                    .accessibilityIdentifier("frame.test-photo")
                }

                if let photoError {
                    Text(photoError.localizedKey)
                        .foregroundStyle(.red)
                        .accessibilityIdentifier("frame.photo-error")
                }

                Button("Back to selection") { store.requestStage(.select) }
                    .frame(minHeight: 44)
                    .accessibilityIdentifier("frame.back")
            }
            .padding(24)
            .frame(maxWidth: 560)
            .frame(maxWidth: .infinity)
        }
        .background(AligneStyle.page)
        .sheet(isPresented: $showingCamera) {
            CameraPicker(onImage: { data in
                showingCamera = false
                acceptPhoto(data)
            }, onCancel: { showingCamera = false })
        }
        .alert("Camera access", isPresented: Binding(
            get: { cameraNotice != nil },
            set: { if !$0 { cameraNotice = nil } }
        )) {
            if cameraNotice == .denied || cameraNotice == .restricted {
                Button("Open Settings") {
                    guard let url = URL(string: UIApplication.openSettingsURLString) else { return }
                    UIApplication.shared.open(url)
                }
            }
            Button("OK", role: .cancel) { cameraNotice = nil }
        } message: {
            Text(cameraNotice == .unavailable
                 ? "Camera is not available on this device. Choose a photo instead."
                 : "Allow camera access in Settings to take a photo.")
        }
    }

    private func openCamera() async {
        let access = await CameraAccess.resolve(using: cameraAuthorizer)
        switch access {
        case .authorized:
            showingCamera = true
        case .denied, .restricted, .unavailable:
            cameraNotice = access
        case .notDetermined:
            cameraNotice = .denied
        }
    }

    private func loadPhoto(_ item: PhotosPickerItem?) async {
        do {
            guard let data = try await photoService.loadData(from: item) else { return }
            acceptPhoto(data)
        } catch let error as ImageInputError {
            photoError = error
        } catch {
            photoError = .decodeFailed
        }
    }

    private func acceptPhoto(_ data: Data) {
        do {
            photoError = nil
            store.selectImage(data: try PhotoSelectionService().validate(data))
        } catch let error as ImageInputError {
            photoError = error
        } catch {
            photoError = .decodeFailed
        }
    }

    private static func samplePhoto() -> Data {
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: 600, height: 800))
        let image = renderer.image { context in
            UIColor.white.setFill()
            context.fill(CGRect(x: 0, y: 0, width: 600, height: 800))
            UIColor.lightGray.setFill()
            for x in stride(from: 0, to: 600, by: 40) {
                context.fill(CGRect(x: x, y: 0, width: 20, height: 800))
            }
        }
        return image.jpegData(compressionQuality: 0.75) ?? Data()
    }
}

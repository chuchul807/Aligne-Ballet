import PhotosUI
import SwiftUI
import UIKit

struct FrameView: View {
    @ObservedObject var store: AnalysisSessionStore
    @Environment(\.locale) private var locale
    var photoService: any PhotoSelectionServing = PhotoSelectionService()
    var cameraAuthorizer: any CameraAuthorizing = SystemCameraAuthorizer()

    @State private var selectedItem: PhotosPickerItem?
    @State private var showingCamera = false
    @State private var cameraNotice: CameraPermissionStatus?
    @State private var photoError: ImageInputError?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                Text(LocalizedCopy.text("frame.eyebrow", locale: locale))
                    .font(.caption.weight(.bold))
                    .tracking(2)
                    .foregroundStyle(AligneStyle.accent)

                Text(LocalizedCopy.text("frame.title", locale: locale))
                    .font(.system(.title, design: .serif, weight: .semibold))
                    .foregroundStyle(AligneStyle.deep)
                    .accessibilityIdentifier("stage.frame.title")

                VStack(alignment: .leading, spacing: 12) {
                    Label(LocalizedCopy.text("frame.head-feet", locale: locale), systemImage: "person.crop.rectangle")
                    Label(LocalizedCopy.text("frame.one-dancer", locale: locale), systemImage: "person")
                    Label(
                        store.expectedView == .front
                            ? LocalizedCopy.text("frame.front", locale: locale)
                            : LocalizedCopy.text("frame.side", locale: locale),
                        systemImage: "camera.viewfinder"
                    )
                }
                .font(.body)
                .foregroundStyle(AligneStyle.deep)
                .padding(18)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(AligneStyle.soft, in: RoundedRectangle(cornerRadius: 14))

                Button(LocalizedCopy.text("frame.camera", locale: locale), systemImage: "camera") {
                    Task { await openCamera() }
                }
                .buttonStyle(PrimaryAligneButtonStyle())
                .accessibilityIdentifier("frame.camera")

                PhotosPicker(selection: $selectedItem, matching: .images) {
                    Label(LocalizedCopy.text("frame.photos", locale: locale), systemImage: "photo.on.rectangle")
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
                    Text(LocalizedCopy.text(photoError.localizedKey, locale: locale))
                        .foregroundStyle(.red)
                        .accessibilityIdentifier("frame.photo-error")
                }

                Button { store.requestStage(.select) } label: {
                    Text(LocalizedCopy.text("frame.back", locale: locale))
                        .frame(maxWidth: .infinity, minHeight: 48)
                        .contentShape(Rectangle())
                }
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
        .alert(LocalizedCopy.text("frame.camera-alert", locale: locale), isPresented: Binding(
            get: { cameraNotice != nil },
            set: { if !$0 { cameraNotice = nil } }
        )) {
            if cameraNotice == .denied || cameraNotice == .restricted {
                Button(LocalizedCopy.text("common.settings", locale: locale)) {
                    guard let url = URL(string: UIApplication.openSettingsURLString) else { return }
                    UIApplication.shared.open(url)
                }
            }
            Button(LocalizedCopy.text("common.ok", locale: locale), role: .cancel) { cameraNotice = nil }
        } message: {
            Text(LocalizedCopy.text(cameraNotice == .unavailable
                 ? "frame.camera-unavailable" : "frame.camera-denied", locale: locale))
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

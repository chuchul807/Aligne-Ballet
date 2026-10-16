import SwiftUI

struct RootView: View {
    @StateObject private var store = AnalysisSessionStore()

    var body: some View {
        NavigationStack {
            Group {
                switch store.stage {
                case .select: SelectView(store: store)
                case .frame: FrameView(store: store, cameraAuthorizer: cameraAuthorizer)
                case .check: CheckView(store: store)
                case .result: ResultView(store: store, photoSaver: photoSaver)
                }
            }
            .navigationTitle("ALIGNÉ")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(AligneStyle.surface, for: .navigationBar)
        }
        .tint(AligneStyle.accent)
    }

    private var cameraAuthorizer: any CameraAuthorizing {
        if ProcessInfo.processInfo.arguments.contains("-aligne-ui-test-camera-unavailable") {
            return UnavailableTestCameraAuthorizer()
        }
        return SystemCameraAuthorizer()
    }

    private var photoSaver: any PhotoSaveServing {
        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains("-aligne-ui-test-save-denied") {
            return DeniedTestPhotoSaver()
        }
        #endif
        return PhotoSaveService()
    }
}

#Preview {
    RootView()
}

import SwiftUI

struct RootView: View {
    @StateObject private var store = AnalysisSessionStore()

    var body: some View {
        NavigationStack {
            Group {
                switch store.stage {
                case .select: SelectView(store: store)
                case .frame: FrameView(store: store, cameraAuthorizer: cameraAuthorizer)
                case .check: checkView
                case .result: resultView
                }
            }
            .navigationTitle("ALIGNÉ")
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(AligneStyle.surface, for: .navigationBar)
        }
        .tint(AligneStyle.accent)
    }

    private var cameraAuthorizer: any CameraAuthorizing {
        ProcessInfo.processInfo.arguments.contains("-aligne-ui-test-camera-unavailable")
            ? UnavailableTestCameraAuthorizer() : SystemCameraAuthorizer()
    }

    @ViewBuilder
    private var checkView: some View {
        VStack(spacing: 18) {
            Text("Check")
                .font(.system(.title, design: .serif, weight: .semibold))
                .foregroundStyle(AligneStyle.deep)
                .accessibilityIdentifier("stage.check.title")
            switch store.analysisState {
            case .loading:
                ProgressView("Analysing your photo…")
            case let .retake(report):
                ForEach(report.reasons, id: \.code) { reason in
                    Text(reason.message).multilineTextAlignment(.center)
                }
            case let .failure(error):
                Text(error.localizedKey)
            default:
                EmptyView()
            }
            Button("Choose another photo") { store.requestStage(.frame) }
                .buttonStyle(PrimaryAligneButtonStyle())
                .accessibilityIdentifier("check.retry")
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(AligneStyle.page)
    }

    @ViewBuilder
    private var resultView: some View {
        VStack(spacing: 18) {
            Text("Result")
                .font(.system(.title, design: .serif, weight: .semibold))
                .accessibilityIdentifier("stage.result.title")
            if case let .success(result, image) = store.analysisState {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFit()
                    .accessibilityLabel("Annotated ballet pose")
                Text("\(result.topCorrections.count) corrections")
            }
            Button("Analyse another photo") { store.reset() }
                .buttonStyle(PrimaryAligneButtonStyle())
        }
        .padding(24)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(AligneStyle.page)
    }
}

#Preview {
    RootView()
}

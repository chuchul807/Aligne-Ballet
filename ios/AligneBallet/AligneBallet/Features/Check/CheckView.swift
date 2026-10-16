import SwiftUI

struct CheckView: View {
    @ObservedObject var store: AnalysisSessionStore
    @Environment(\.locale) private var locale

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text(LocalizedCopy.text("check.title", locale: locale))
                    .font(.system(.title, design: .serif, weight: .semibold))
                    .foregroundStyle(AligneStyle.deep)
                    .accessibilityIdentifier("stage.check.title")
                switch store.analysisState {
                case .loading:
                    ProgressView(LocalizedCopy.text("check.loading", locale: locale))
                        .frame(maxWidth: .infinity, minHeight: 120)
                case let .retake(report):
                    Text(LocalizedCopy.text("check.retake", locale: locale)).font(.headline)
                    ForEach(report.reasons, id: \.code) { reason in
                        Label(LocalizedCopy.text("quality.\(reason.code.rawValue)", locale: locale),
                              systemImage: "camera.viewfinder")
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                case let .failure(error):
                    Text(LocalizedCopy.text("check.failure", locale: locale)).font(.headline)
                    Text(LocalizedCopy.text(error.localizedKey, locale: locale))
                case .idle, .success:
                    EmptyView()
                }
                Button(LocalizedCopy.text("check.retry", locale: locale)) {
                    store.requestStage(.frame)
                }
                .buttonStyle(PrimaryAligneButtonStyle())
                .accessibilityIdentifier("check.retry")
            }
            .foregroundStyle(AligneStyle.deep)
            .padding(24)
            .frame(maxWidth: 560)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(AligneStyle.page)
    }
}

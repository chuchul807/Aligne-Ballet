import SwiftUI
import UIKit

#if DEBUG
struct DeniedTestPhotoSaver: PhotoSaveServing {
    func save(_ image: UIImage) async throws { throw PhotoSaveError.permissionDenied }
}
#endif

struct ResultView: View {
    @ObservedObject var store: AnalysisSessionStore
    var photoSaver: any PhotoSaveServing = PhotoSaveService()

    @Environment(\.locale) private var locale
    @State private var isSaving = false
    @State private var saveSucceeded = false
    @State private var saveError: PhotoSaveError?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                Text(LocalizedCopy.text("result.title", locale: locale))
                    .font(.system(.title, design: .serif, weight: .semibold))
                    .foregroundStyle(AligneStyle.deep)
                    .accessibilityIdentifier("stage.result.title")

                if case let .success(result, image) = store.analysisState {
                    Image(uiImage: image)
                        .resizable()
                        .scaledToFit()
                        .frame(maxWidth: .infinity)
                        .background(AligneStyle.surface, in: RoundedRectangle(cornerRadius: 14))
                        .accessibilityLabel(LocalizedCopy.text("result.image-label", locale: locale))
                        .accessibilityIdentifier("result.annotated-image")

                    Text(LocalizedCopy.text("result.top-three", locale: locale))
                        .font(.headline)
                    if result.topCorrections.isEmpty {
                        Text(LocalizedCopy.text("result.no-correction", locale: locale))
                    } else {
                        ForEach(Array(result.topCorrections.prefix(3).enumerated()), id: \.element.observationID) { index, correction in
                            HStack(alignment: .top, spacing: 10) {
                                Text("\(index + 1).").fontWeight(.bold)
                                Text(LocalizedCopy.feedback(ruleID: correction.ruleID,
                                                            confidence: correction.confidence,
                                                            locale: locale))
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(14)
                            .background(AligneStyle.surface, in: RoundedRectangle(cornerRadius: 12))
                        }
                    }

                    DisclosureGroup {
                        ForEach(result.fullBodyReview, id: \.region) { section in
                            VStack(alignment: .leading, spacing: 5) {
                                Text(LocalizedCopy.text("region.\(section.region.rawValue)", locale: locale))
                                    .font(.headline)
                                Text(LocalizedCopy.text("review.\(section.status.rawValue)", locale: locale))
                                    .font(.subheadline)
                                ForEach(section.items, id: \.observationID) { item in
                                    Text(reviewText(item, status: section.status))
                                }
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.vertical, 8)
                        }
                    } label: {
                        Text(LocalizedCopy.text("result.full-review", locale: locale)).font(.headline)
                    }
                    .accessibilityIdentifier("result.full-review")

                    Text(LocalizedCopy.text("result.disclaimer", locale: locale))
                        .font(.footnote)
                        .foregroundStyle(AligneStyle.muted)
                        .accessibilityIdentifier("result.disclaimer")

                    Button {
                        Task { await save(image) }
                    } label: {
                        Label(LocalizedCopy.text("result.save", locale: locale), systemImage: "square.and.arrow.down")
                    }
                    .buttonStyle(PrimaryAligneButtonStyle())
                    .disabled(isSaving)
                    .accessibilityIdentifier("result.save")

                    if saveSucceeded {
                        Label(LocalizedCopy.text("result.saved", locale: locale), systemImage: "checkmark.circle")
                            .accessibilityIdentifier("result.save.success")
                    }
                    if let saveError {
                        Text(LocalizedCopy.text(
                            saveError == .permissionDenied ? "result.save-denied" : "result.save-failed",
                            locale: locale
                        ))
                        .foregroundStyle(.red)
                        .accessibilityIdentifier("result.save.error")
                        if saveError == .permissionDenied {
                            Button(LocalizedCopy.text("common.settings", locale: locale)) {
                                guard let url = URL(string: UIApplication.openSettingsURLString) else { return }
                                UIApplication.shared.open(url)
                            }
                            .frame(minHeight: 44)
                            .accessibilityIdentifier("result.save.settings")
                        }
                    }
                }

                Button { store.reset() } label: {
                    Text(LocalizedCopy.text("result.reset", locale: locale))
                        .frame(maxWidth: .infinity, minHeight: 48)
                        .contentShape(Rectangle())
                }
                    .accessibilityIdentifier("result.reset")
            }
            .foregroundStyle(AligneStyle.deep)
            .padding(24)
            .frame(maxWidth: 560)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(AligneStyle.page)
    }

    private func reviewText(_ item: FeedbackItem, status: FullBodyStatus) -> String {
        switch status {
        case .finding:
            return LocalizedCopy.feedback(ruleID: item.observationID, confidence: item.confidence,
                                          locale: locale)
        case .clear:
            return LocalizedCopy.text("review.no-visible-issue", locale: locale)
        case .unassessable:
            let key = item.observationID.hasPrefix("coverage-") ? "review.occluded" : "review.insufficient"
            return LocalizedCopy.text(key, locale: locale)
        }
    }

    private func save(_ image: UIImage) async {
        guard !isSaving else { return }
        isSaving = true
        saveError = nil
        do {
            try await photoSaver.save(image)
            saveSucceeded = true
        } catch let error as PhotoSaveError {
            saveError = error
        } catch {
            saveError = .saveFailed
        }
        isSaving = false
    }
}

import SwiftUI

enum AligneStyle {
    static let page = Color(red: 247 / 255, green: 220 / 255, blue: 225 / 255)
    static let surface = Color(red: 1, green: 248 / 255, blue: 250 / 255)
    static let soft = Color(red: 242 / 255, green: 194 / 255, blue: 199 / 255)
    static let accent = Color(red: 167 / 255, green: 71 / 255, blue: 102 / 255)
    static let deep = Color(red: 101 / 255, green: 50 / 255, blue: 70 / 255)
    static let muted = Color(red: 117 / 255, green: 81 / 255, blue: 95 / 255)
}

extension PoseName {
    var displayName: String {
        switch self {
        case .arabesque: "Arabesque"
        case .attitudeDerriere: "Attitude derrière"
        case .retirePasse: "Retiré / Passé"
        case .aLaSeconde: "À la seconde"
        case .tenduCroiseDevant: "Tendu croisé devant"
        }
    }
}

struct SelectView: View {
    @ObservedObject var store: AnalysisSessionStore
    @Environment(\.locale) private var locale

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                Text(LocalizedCopy.text("select.eyebrow", locale: locale))
                    .font(.caption.weight(.bold))
                    .tracking(2)
                    .foregroundStyle(AligneStyle.accent)

                Text(LocalizedCopy.text("select.title", locale: locale))
                    .font(.system(.title, design: .serif, weight: .semibold))
                    .foregroundStyle(AligneStyle.deep)
                    .accessibilityIdentifier("stage.select.title")

                Text(LocalizedCopy.text("select.instructions", locale: locale))
                    .font(.body)
                    .foregroundStyle(AligneStyle.muted)

                VStack(alignment: .leading, spacing: 12) {
                    Text(LocalizedCopy.text("select.position", locale: locale))
                        .font(.headline)
                        .foregroundStyle(AligneStyle.deep)
                    ForEach(PoseName.allCases, id: \.self) { pose in
                        Button {
                            store.position = pose
                        } label: {
                            HStack(spacing: 12) {
                                Image(systemName: store.position == pose
                                      ? "largecircle.fill.circle" : "circle")
                                    .foregroundStyle(AligneStyle.accent)
                                VStack(alignment: .leading, spacing: 4) {
                                    Text(pose.displayName)
                                        .font(.headline)
                                        .foregroundStyle(AligneStyle.deep)
                                    Text(LocalizedCopy.text(
                                        "pose.description.\(pose.rawValue)", locale: locale
                                    ))
                                    .font(.subheadline)
                                    .foregroundStyle(AligneStyle.muted)
                                }
                                Spacer()
                            }
                            .padding(14)
                            .frame(minHeight: 48)
                            .background(store.position == pose ? AligneStyle.soft : .white,
                                        in: RoundedRectangle(cornerRadius: 12))
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel(
                            pose.displayName + ". "
                                + LocalizedCopy.text("pose.description.\(pose.rawValue)", locale: locale)
                        )
                        .accessibilityIdentifier("pose.\(pose.rawValue)")
                        .accessibilityAddTraits(store.position == pose ? .isSelected : [])
                    }
                }

                VStack(alignment: .leading, spacing: 10) {
                    Text(LocalizedCopy.text("select.supporting-leg", locale: locale))
                        .font(.headline)
                        .foregroundStyle(AligneStyle.deep)
                    Picker(LocalizedCopy.text("select.supporting-leg", locale: locale), selection: $store.supportingSide) {
                        Text(LocalizedCopy.text("select.left", locale: locale)).tag(SupportingSide.left)
                        Text(LocalizedCopy.text("select.right", locale: locale)).tag(SupportingSide.right)
                    }
                    .pickerStyle(.segmented)
                    .accessibilityIdentifier("supporting-side")
                }

                Label(
                    store.expectedView == .front
                        ? LocalizedCopy.text("select.view-front", locale: locale)
                        : LocalizedCopy.text("select.view-side", locale: locale),
                    systemImage: "viewfinder"
                )
                .font(.subheadline)
                .foregroundStyle(AligneStyle.deep)
                .padding(14)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(AligneStyle.soft, in: RoundedRectangle(cornerRadius: 12))
                .accessibilityIdentifier("recommended-view")

                Button(LocalizedCopy.text("select.continue", locale: locale)) {
                    store.requestStage(.frame)
                }
                .buttonStyle(PrimaryAligneButtonStyle())
                .accessibilityIdentifier("select.continue")
            }
            .padding(24)
            .frame(maxWidth: 560)
            .frame(maxWidth: .infinity)
        }
        .background(AligneStyle.page)
    }
}

struct PrimaryAligneButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .frame(maxWidth: .infinity, minHeight: 48)
            .foregroundStyle(.white)
            .background(AligneStyle.accent.opacity(configuration.isPressed ? 0.75 : 1),
                        in: RoundedRectangle(cornerRadius: 12))
    }
}

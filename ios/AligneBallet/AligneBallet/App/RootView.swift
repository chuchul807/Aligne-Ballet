import SwiftUI

struct RootView: View {
    var body: some View {
        NavigationStack {
            VStack(spacing: 16) {
                Text("ALIGNÉ")
                    .font(.largeTitle)
                    .fontWeight(.semibold)

                Text("Select")
                    .font(.title2)
                    .accessibilityIdentifier("stage.select.title")
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .navigationTitle("ALIGNÉ")
        }
    }
}

#Preview {
    RootView()
}

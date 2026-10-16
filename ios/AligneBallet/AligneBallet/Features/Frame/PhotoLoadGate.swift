import Foundation

@MainActor
final class PhotoLoadGate {
    private var generation = 0

    func begin() -> Int {
        generation &+= 1
        return generation
    }

    func invalidate() {
        generation &+= 1
    }

    func mayAccept(_ token: Int, stage: AnalysisStage) -> Bool {
        token == generation && stage == .frame
    }
}

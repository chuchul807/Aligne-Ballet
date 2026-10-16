import Combine
import Foundation
import SwiftUI

protocol AnalysisRunning: Sendable {
    func analyze(_ request: AnalysisRequest) async -> AnalysisOutcome
}

actor LiveAnalysisRunner: AnalysisRunning {
    private var detector: MediaPipePoseDetector?

    func analyze(_ request: AnalysisRequest) async -> AnalysisOutcome {
        if Task.isCancelled { return .cancelled }
        if detector == nil {
            guard let modelURL = Bundle.main.url(
                forResource: "pose_landmarker_heavy", withExtension: "task"
            ), let loaded = try? MediaPipePoseDetector(modelURL: modelURL) else {
                return .failure(.modelUnavailable)
            }
            detector = loaded
        }
        if Task.isCancelled { return .cancelled }
        guard let detector else { return .failure(.modelUnavailable) }
        return await AnalysisPipeline(detector: detector).analyze(request)
    }
}

enum AnalysisState {
    case idle
    case loading
    case retake(QualityReport)
    case success(AnalysisResult, UIImage)
    case failure(AnalysisError)
}

private final class WeakAnalysisStore: @unchecked Sendable {
    weak var value: AnalysisSessionStore?
    init(_ value: AnalysisSessionStore) { self.value = value }
}

@MainActor
final class AnalysisSessionStore: ObservableObject {
    @Published private(set) var stage: AnalysisStage = .select
    @Published var position: PoseName = .arabesque
    @Published var supportingSide: SupportingSide = .left
    @Published private(set) var analysisState: AnalysisState = .idle

    private let runner: any AnalysisRunning
    private var generation = 0
    private var analysisTask: Task<Void, Never>?

    init(runner: any AnalysisRunning = LiveAnalysisRunner()) {
        self.runner = runner
        #if DEBUG
        if ProcessInfo.processInfo.arguments.contains("-aligne-ui-test-result") {
            let image = UIGraphicsImageRenderer(size: CGSize(width: 600, height: 800))
                .image { context in
                    UIColor.white.setFill()
                    context.fill(CGRect(x: 0, y: 0, width: 600, height: 800))
                }
            analysisState = .success(
                AnalysisResult(sessionID: "ui-test", position: .arabesque, landmarks: [],
                               topCorrections: [], fullBodyReview: [], annotations: [],
                               createdAt: "2026-10-16T00:00:00Z"),
                image
            )
            stage = .result
        }
        #endif
    }

    var expectedView: ViewType {
        switch position {
        case .arabesque, .attitudeDerriere: .threeQuarterSide
        case .retirePasse, .aLaSeconde, .tenduCroiseDevant: .front
        }
    }

    func selectImage(data: Data) {
        generation += 1
        analysisTask?.cancel()
        analysisState = .loading
        stage = .check
        let currentGeneration = generation
        let runner = self.runner
        let target = WeakAnalysisStore(self)
        let request = AnalysisRequest(
            imageData: data, position: position, supportingSide: supportingSide,
            expectedView: expectedView
        )
        analysisTask = Task.detached(priority: .userInitiated) {
            let outcome = await runner.analyze(request)
            await MainActor.run {
                guard let self = target.value,
                      self.generation == currentGeneration else { return }
                self.analysisTask = nil
                switch outcome {
                case .cancelled:
                    self.analysisState = .idle
                    self.stage = .frame
                case let .retake(report):
                    self.analysisState = .retake(report)
                    self.stage = .check
                case let .success(result, image):
                    self.analysisState = .success(result, image)
                    self.stage = .result
                case let .failure(error):
                    self.analysisState = .failure(error)
                    self.stage = .check
                }
            }
        }
    }

    func cancelAnalysis() {
        generation += 1
        analysisTask?.cancel()
        analysisTask = nil
        analysisState = .idle
        stage = .frame
    }

    func requestStage(_ requested: AnalysisStage) {
        switch requested {
        case .select:
            generation += 1
            analysisTask?.cancel()
            analysisTask = nil
            analysisState = .idle
            stage = .select
        case .frame:
            cancelAnalysis()
        case .check:
            if case .idle = analysisState { return }
            stage = .check
        case .result:
            if case .success = analysisState { stage = .result }
        }
    }

    func reset() {
        requestStage(.select)
        position = .arabesque
        supportingSide = .left
    }
}

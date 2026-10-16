import XCTest
@testable import AligneBallet

@MainActor
final class AnalysisSessionStoreTests: XCTestCase {
    actor ControlledRunner: AnalysisRunning {
        private var pending: [CheckedContinuation<AnalysisOutcome, Never>] = []
        private var waiters: [(Int, CheckedContinuation<Void, Never>)] = []

        func analyze(_ request: AnalysisRequest) async -> AnalysisOutcome {
            await withCheckedContinuation { continuation in
                pending.append(continuation)
                let ready = waiters.filter { pending.count >= $0.0 }
                waiters.removeAll { pending.count >= $0.0 }
                ready.forEach { $0.1.resume() }
            }
        }

        func waitForCount(_ count: Int) async {
            if pending.count >= count { return }
            await withCheckedContinuation { waiters.append((count, $0)) }
        }

        func complete(_ index: Int, with outcome: AnalysisOutcome) {
            pending[index].resume(returning: outcome)
        }
    }

    private func report(_ code: QualityReasonCode) -> QualityReport {
        QualityReport(status: .fail, reasons: [QualityReason(code: code, message: code.rawValue)],
                      unassessableRegions: [], imageWasResized: nil)
    }

    func testPositionViewMappingAndStageRules() {
        let store = AnalysisSessionStore(runner: ControlledRunner())
        XCTAssertEqual(store.stage, .select)
        XCTAssertEqual(store.expectedView, .threeQuarterSide)
        store.position = .aLaSeconde
        XCTAssertEqual(store.expectedView, .front)
        store.position = .tenduCroiseDevant
        XCTAssertEqual(store.expectedView, .front)
        store.position = .retirePasse
        XCTAssertEqual(store.expectedView, .front)
        store.position = .attitudeDerriere
        XCTAssertEqual(store.expectedView, .threeQuarterSide)
        store.requestStage(.result)
        XCTAssertEqual(store.stage, .select)
        store.requestStage(.frame)
        XCTAssertEqual(store.stage, .frame)
        store.requestStage(.check)
        XCTAssertEqual(store.stage, .frame)
        store.requestStage(.select)
        XCTAssertEqual(store.stage, .select)
    }

    func testLateAnalysisCannotReplaceNewerPhoto() async {
        let runner = ControlledRunner()
        let store = AnalysisSessionStore(runner: runner)
        store.requestStage(.frame)
        store.selectImage(data: Data([1]))
        await runner.waitForCount(1)
        store.selectImage(data: Data([2]))
        await runner.waitForCount(2)
        await runner.complete(1, with: .retake(report(.multiplePeople)))
        await Task.yield()
        guard case let .retake(current) = store.analysisState else {
            return XCTFail("Expected current retake")
        }
        XCTAssertEqual(current.reasons.first?.code, .multiplePeople)
        await runner.complete(0, with: .retake(report(.noPerson)))
        await Task.yield()
        guard case let .retake(afterLate) = store.analysisState else {
            return XCTFail("Late result replaced newer photo")
        }
        XCTAssertEqual(afterLate.reasons.first?.code, .multiplePeople)
    }

    func testCancelAndResetInvalidatePendingWork() async {
        let runner = ControlledRunner()
        let store = AnalysisSessionStore(runner: runner)
        store.requestStage(.frame)
        store.selectImage(data: Data([1]))
        await runner.waitForCount(1)
        store.cancelAnalysis()
        XCTAssertEqual(store.stage, .frame)
        guard case .idle = store.analysisState else { return XCTFail("Expected idle") }
        await runner.complete(0, with: .retake(report(.noPerson)))
        await Task.yield()
        guard case .idle = store.analysisState else { return XCTFail("Cancelled result appeared") }
        store.reset()
        XCTAssertEqual(store.stage, .select)
        XCTAssertEqual(store.position, .arabesque)
        XCTAssertEqual(store.supportingSide, .left)
    }
}

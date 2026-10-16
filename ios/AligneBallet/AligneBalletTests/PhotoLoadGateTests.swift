import XCTest
@testable import AligneBallet

@MainActor
final class PhotoLoadGateTests: XCTestCase {
    func testOnlyLatestSelectionCanComplete() {
        let gate = PhotoLoadGate()
        let first = gate.begin()
        let second = gate.begin()
        XCTAssertFalse(gate.mayAccept(first, stage: .frame))
        XCTAssertTrue(gate.mayAccept(second, stage: .frame))
    }

    func testLeavingFrameInvalidatesPendingLoad() {
        let gate = PhotoLoadGate()
        let token = gate.begin()
        gate.invalidate()
        XCTAssertFalse(gate.mayAccept(token, stage: .frame))
        XCTAssertFalse(gate.mayAccept(token, stage: .select))
    }

    func testStageChangeRejectsCompletionEvenWithoutExplicitInvalidation() {
        let gate = PhotoLoadGate()
        let token = gate.begin()
        XCTAssertFalse(gate.mayAccept(token, stage: .check))
    }
}

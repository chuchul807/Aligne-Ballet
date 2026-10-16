import XCTest
@testable import AligneBallet

final class CameraPermissionTests: XCTestCase {
    private struct Fake: CameraAuthorizing {
        let status: CameraPermissionStatus
        let granted: Bool
        func requestAccess() async -> Bool { granted }
    }

    func testAuthorizedDeniedRestrictedAndUnavailable() async {
        for status: CameraPermissionStatus in [.authorized, .denied, .restricted, .unavailable] {
            let resolved = await CameraAccess.resolve(using: Fake(status: status, granted: true))
            XCTAssertEqual(resolved, status)
        }
    }

    func testFirstPermissionRequestResolvesOutcome() async {
        let accepted = await CameraAccess.resolve(using: Fake(status: .notDetermined, granted: true))
        let rejected = await CameraAccess.resolve(using: Fake(status: .notDetermined, granted: false))
        XCTAssertEqual(accepted, .authorized)
        XCTAssertEqual(rejected, .denied)
    }
}

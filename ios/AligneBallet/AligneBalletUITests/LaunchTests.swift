import XCTest

final class LaunchTests: XCTestCase {
    override func setUpWithError() throws {
        continueAfterFailure = false
    }

    @MainActor
    func testAppLaunchesAtSelectStage() {
        let app = XCUIApplication()
        app.launch()

        XCTAssertTrue(app.staticTexts["stage.select.title"].waitForExistence(timeout: 5))
    }
}

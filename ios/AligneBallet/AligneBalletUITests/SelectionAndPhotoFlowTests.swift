import XCTest

final class SelectionAndPhotoFlowTests: XCTestCase {
    override func setUpWithError() throws { continueAfterFailure = false }

    @MainActor
    func testSelectPoseThenFrameAndBack() {
        let app = XCUIApplication()
        app.launch()
        XCTAssertTrue(app.staticTexts["stage.select.title"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["pose.arabesque"].label.contains("One leg extends behind"))
        app.buttons["pose.a-la-seconde"].tap()
        XCTAssertTrue(app.buttons["pose.a-la-seconde"].label.contains("One leg extends to the side"))
        XCTAssertTrue(app.staticTexts["Recommended view: front"].exists)
        app.buttons["select.continue"].tap()
        XCTAssertTrue(app.staticTexts["stage.frame.title"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["frame.photos"].exists)
        XCTAssertTrue(app.buttons["frame.camera"].exists)
        XCTAssertGreaterThanOrEqual(app.buttons["frame.back"].frame.height, 44)
        app.buttons["frame.back"].tap()
        XCTAssertTrue(app.staticTexts["stage.select.title"].waitForExistence(timeout: 5))
    }

    @MainActor
    func testCameraUnavailableKeepsFrameAndOffersPhotoChoice() {
        let app = XCUIApplication()
        app.launchArguments.append("-aligne-ui-test-camera-unavailable")
        app.launch()
        app.buttons["select.continue"].tap()
        app.buttons["frame.camera"].tap()
        XCTAssertTrue(app.alerts["Camera access"].waitForExistence(timeout: 5))
        app.alerts.buttons["OK"].tap()
        XCTAssertTrue(app.staticTexts["stage.frame.title"].exists)
        XCTAssertTrue(app.buttons["frame.photos"].exists)
    }

    @MainActor
    func testInjectedPhotoRunsCheckAndAllowsRetry() {
        let app = XCUIApplication()
        app.launchArguments.append("-aligne-ui-test-photo")
        app.launch()
        app.buttons["select.continue"].tap()
        app.buttons["frame.test-photo"].tap()
        XCTAssertTrue(app.staticTexts["stage.check.title"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.buttons["check.retry"].exists)
        app.buttons["check.retry"].tap()
        XCTAssertTrue(app.staticTexts["stage.frame.title"].waitForExistence(timeout: 5))
    }
}

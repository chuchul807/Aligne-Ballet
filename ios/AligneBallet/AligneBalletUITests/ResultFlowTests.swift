import XCTest

final class ResultFlowTests: XCTestCase {
    override func setUpWithError() throws { continueAfterFailure = false }

    @MainActor
    func testResultShowsAnnotatedImageReviewAndSaveWithoutAutomaticSave() {
        let app = XCUIApplication()
        app.launchArguments.append("-aligne-ui-test-result")
        app.launch()
        XCTAssertTrue(app.staticTexts["stage.result.title"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.images["result.annotated-image"].exists)
        XCTAssertTrue(app.buttons["result.save"].exists)
        XCTAssertFalse(app.staticTexts["result.save.success"].exists)
        app.buttons["result.full-review"].tap()
        XCTAssertTrue(app.staticTexts["result.disclaimer"].exists)
        app.buttons["result.reset"].tap()
        XCTAssertTrue(app.staticTexts["stage.select.title"].waitForExistence(timeout: 5))
    }

    @MainActor
    func testDeniedSaveKeepsResultAndOffersSettings() {
        let app = XCUIApplication()
        app.launchArguments += ["-aligne-ui-test-result", "-aligne-ui-test-save-denied"]
        app.launch()
        app.buttons["result.save"].tap()
        XCTAssertTrue(app.staticTexts["result.save.error"].waitForExistence(timeout: 5))
        XCTAssertTrue(app.buttons["result.save.settings"].exists)
        XCTAssertTrue(app.staticTexts["stage.result.title"].exists)
    }

    @MainActor
    func testResultButtonsHaveTouchTargets() {
        let app = XCUIApplication()
        app.launchArguments.append("-aligne-ui-test-result")
        app.launch()
        XCTAssertTrue(app.staticTexts["stage.result.title"].waitForExistence(timeout: 5))
        XCTAssertGreaterThanOrEqual(app.buttons["result.save"].frame.height, 44)
        XCTAssertGreaterThanOrEqual(app.buttons["result.reset"].frame.height, 44)
    }
}

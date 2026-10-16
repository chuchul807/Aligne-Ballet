import Foundation
import XCTest
@testable import AligneBallet

final class LocalizationTests: XCTestCase {
    func testEveryRequiredPresentationKeyHasEnglishAndChinese() {
        for key in LocalizedCopy.requiredKeys {
            let en = LocalizedCopy.text(key, locale: Locale(identifier: "en"))
            let zh = LocalizedCopy.text(key, locale: Locale(identifier: "zh-Hans"))
            XCTAssertFalse(en.isEmpty, key)
            XCTAssertFalse(zh.isEmpty, key)
            XCTAssertNotEqual(en, key, key)
            XCTAssertNotEqual(zh, key, key)
            XCTAssertNotEqual(en, zh, key)
        }
    }

    func testAllFeedbackKeysHaveTranslatedCopy() {
        for rule in RuleEngine.allRuleIDs {
            let key = FeedbackCopy.key(ruleID: rule, confidence: .high)
            XCTAssertNotEqual(LocalizedCopy.text(key, locale: Locale(identifier: "zh-Hans")), key)
        }
    }

    func testNoRawRuleIdentifierIsShownToUser() {
        for rule in RuleEngine.allRuleIDs {
            let rendered = LocalizedCopy.feedback(ruleID: rule, confidence: .high,
                                                  locale: Locale(identifier: "zh-Hans"))
            XCTAssertFalse(rendered.contains(rule), rule)
        }
    }

    func testEveryPoseHasDistinctEnglishAndSimplifiedChineseDescription() {
        for pose in PoseName.allCases {
            let key = "pose.description.\(pose.rawValue)"
            let en = LocalizedCopy.text(key, locale: Locale(identifier: "en"))
            let zh = LocalizedCopy.text(key, locale: Locale(identifier: "zh-Hans"))
            XCTAssertNotEqual(en, key)
            XCTAssertNotEqual(zh, key)
            XCTAssertNotEqual(en, zh)
        }
    }

    func testTraditionalChineseFallsBackToEnglish() {
        let key = "select.title"
        let english = LocalizedCopy.text(key, locale: Locale(identifier: "en"))
        XCTAssertEqual(LocalizedCopy.text(key, locale: Locale(identifier: "zh-Hant")), english)
        XCTAssertEqual(LocalizedCopy.text(key, locale: Locale(identifier: "zh-TW")), english)
    }
}

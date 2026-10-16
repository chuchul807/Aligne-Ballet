import Foundation

enum LocalizedCopy {
    static let uiKeys = [
        "select.eyebrow", "select.title", "select.instructions", "select.position",
        "select.supporting-leg", "select.left", "select.right", "select.view-front",
        "select.view-side", "select.continue", "frame.eyebrow", "frame.title",
        "frame.head-feet", "frame.one-dancer", "frame.front", "frame.side",
        "frame.camera", "frame.photos", "frame.back", "frame.camera-alert",
        "frame.camera-unavailable", "frame.camera-denied", "common.settings", "common.ok",
        "check.title", "check.loading", "check.retake", "check.failure", "check.retry",
        "result.title", "result.top-three", "result.no-correction", "result.full-review",
        "result.save", "result.saved", "result.save-denied", "result.save-failed",
        "result.reset", "result.image-label", "result.disclaimer",
        "review.finding", "review.clear", "review.unassessable",
        "review.no-visible-issue", "review.insufficient", "review.occluded"
    ]

    static var requiredKeys: [String] {
        uiKeys
        + BodyRegion.allCases.map { "region.\($0.rawValue)" }
        + QualityReasonCode.allCases.map { "quality.\($0.rawValue)" }
        + ["image.error.unsupported-type", "image.error.file-too-large",
           "image.error.too-small", "image.error.normalisation", "image.error.memory",
           "image.error.decode", "analysis.error.model-unavailable",
           "analysis.error.detection", "analysis.error.rendering"]
        + RuleEngine.allRuleIDs.flatMap { rule in
            [Confidence.high, .medium].map { FeedbackCopy.key(ruleID: rule, confidence: $0) }
        }
    }

    static func text(_ key: String, locale: Locale = .current) -> String {
        let folder = locale.identifier.hasPrefix("zh") ? "zh-Hans" : "en"
        guard let path = Bundle.main.path(forResource: folder, ofType: "lproj"),
              let bundle = Bundle(path: path) else { return key }
        return bundle.localizedString(forKey: key, value: key, table: "Localizable")
    }

    static func feedback(ruleID: String, confidence: Confidence, locale: Locale = .current) -> String {
        let key = FeedbackCopy.key(ruleID: ruleID, confidence: confidence)
        let localized = text(key, locale: locale)
        if localized != key { return localized }
        return FeedbackCopy.english(ruleID: ruleID, confidence: confidence)
            ?? text("review.insufficient", locale: locale)
    }
}

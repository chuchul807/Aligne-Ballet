import Foundation

struct FeedbackSummary {
    let topCorrections: [CorrectionFeedbackItem]
    let fullBodyReview: [FullBodySection]
}

enum FeedbackComposer {
    static func compose(
        observations: [Observation],
        coverage: [BodyRegion: Assessability]
    ) -> FeedbackSummary {
        let deduplicated = deduplicate(observations)
        let actionable = deduplicated
            .filter { $0.assessability == .assessable && $0.confidence == .high }
            .filter { coverage[$0.region] == .assessable }
            .sorted(by: compareForPresentation)
        let corrections = Array(actionable.prefix(3)).map(feedbackItem)

        let fullBodyReview = BodyRegion.allCases.map { region -> FullBodySection in
            if coverage[region] == .unassessable {
                return FullBodySection(
                    region: region,
                    status: .unassessable,
                    items: [placeholder(
                        id: "coverage-\(region.rawValue)",
                        text: "Unable to assess this area reliably because the joint may be obscured or inconsistent.",
                        region: region,
                        confidence: .medium
                    )]
                )
            }
            let findings = actionable.filter { $0.region == region }.map { feedbackItem($0).feedbackItem }
            if !findings.isEmpty {
                return FullBodySection(region: region, status: .finding, items: findings)
            }
            let insufficient = deduplicated.contains {
                $0.region == region && ($0.assessability == .unassessable || $0.confidence != .high)
            }
            return FullBodySection(
                region: region,
                status: insufficient ? .unassessable : .clear,
                items: [placeholder(
                    id: "\(insufficient ? "insufficient" : "clear")-\(region.rawValue)",
                    text: insufficient
                        ? "Not enough evidence in this photo to recommend a change."
                        : "No visible issue found in this view.",
                    region: region,
                    confidence: insufficient ? .medium : .high
                )]
            )
        }
        return FeedbackSummary(topCorrections: corrections, fullBodyReview: fullBodyReview)
    }

    private static func feedbackItem(_ observation: Observation) -> CorrectionFeedbackItem {
        CorrectionFeedbackItem(
            observationID: observation.id,
            text: FeedbackCopy.english(ruleID: observation.ruleID, confidence: .high)
                ?? FeedbackCopy.key(ruleID: observation.ruleID, confidence: .high),
            region: observation.region,
            priority: observation.priority,
            confidence: observation.confidence,
            ruleID: observation.ruleID,
            direction: observation.direction ?? ""
        )
    }

    private static func placeholder(
        id: String,
        text: String,
        region: BodyRegion,
        confidence: Confidence
    ) -> FeedbackItem {
        FeedbackItem(
            observationID: id,
            text: text,
            region: region,
            priority: .line,
            confidence: confidence
        )
    }

    private static func deduplicate(_ observations: [Observation]) -> [Observation] {
        var winners = [String: (Observation, Int)]()
        for (index, observation) in observations.enumerated() {
            if let existing = winners[observation.dedupeKey],
               !betterCandidate(observation, than: existing.0) {
                continue
            }
            winners[observation.dedupeKey] = (observation, index)
        }
        return winners.values.sorted { $0.1 < $1.1 }.map(\.0)
    }

    private static func betterCandidate(_ left: Observation, than right: Observation) -> Bool {
        if left.assessability != right.assessability {
            return left.assessability == .assessable
        }
        if left.confidence != right.confidence {
            return confidenceRank(left.confidence) > confidenceRank(right.confidence)
        }
        if left.priority != right.priority {
            return priorityRank(left.priority) < priorityRank(right.priority)
        }
        if left.severity != right.severity {
            return (left.severity ?? -.infinity) > (right.severity ?? -.infinity)
        }
        return left.ruleID < right.ruleID
    }

    private static func compareForPresentation(_ left: Observation, _ right: Observation) -> Bool {
        if left.priority != right.priority {
            return priorityRank(left.priority) < priorityRank(right.priority)
        }
        if left.severity != right.severity {
            return (left.severity ?? -.infinity) > (right.severity ?? -.infinity)
        }
        return left.ruleID < right.ruleID
    }

    private static func confidenceRank(_ value: Confidence) -> Int {
        switch value { case .low: 0; case .medium: 1; case .high: 2 }
    }

    private static func priorityRank(_ value: Priority) -> Int {
        switch value { case .stability: 0; case .structure: 1; case .line: 2 }
    }
}

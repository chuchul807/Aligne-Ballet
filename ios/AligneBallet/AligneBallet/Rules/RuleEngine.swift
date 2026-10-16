import Foundation

enum RuleEngine {
    static func evaluate(rules: [Rule], context: RuleContext) -> [Observation] {
        rules.compactMap { rule in
            guard rule.positions.contains(context.position) else { return nil }
            if let supportedViews = rule.supportedViews,
               context.view.map(supportedViews.contains) != true {
                return unavailable(rule)
            }
            if rule.requiredMeasurements.contains(where: { key in
                let measurement = context.measurements[keyPath: key]
                return measurement.assessability != .assessable
                    || !(measurement.value?.isFinite ?? false)
            }) {
                return unavailable(rule)
            }
            guard let finding = rule.evaluate(context) else { return nil }
            if finding.assessability == .unassessable {
                return Observation(
                    id: rule.id,
                    ruleID: rule.id,
                    dedupeKey: rule.dedupeKey,
                    region: rule.region,
                    priority: finding.priority ?? rule.priority,
                    confidence: .low,
                    evidence: finding.evidence,
                    annotation: finding.annotation,
                    assessability: .unassessable,
                    issue: nil,
                    action: nil,
                    direction: nil,
                    severity: nil
                )
            }
            let confidences = rule.requiredMeasurements.map { context.measurements[keyPath: $0].confidence }
                + finding.evidence.map { context.reliability[$0]?.confidence ?? .low }
            let confidence = confidences.min(by: { rank($0) < rank($1) }) ?? .high
            return Observation(
                id: rule.id,
                ruleID: rule.id,
                dedupeKey: rule.dedupeKey,
                region: rule.region,
                priority: finding.priority ?? rule.priority,
                confidence: confidence,
                evidence: finding.evidence,
                annotation: finding.annotation,
                assessability: .assessable,
                issue: nil,
                action: nil,
                direction: finding.direction,
                severity: finding.severity.isFinite ? RuleMath.clamp01(finding.severity) : 0
            )
        }
    }

    private static func unavailable(_ rule: Rule) -> Observation {
        Observation(
            id: rule.id,
            ruleID: rule.id,
            dedupeKey: rule.dedupeKey,
            region: rule.region,
            priority: rule.priority,
            confidence: .low,
            evidence: rule.evidence,
            annotation: [],
            assessability: .unassessable,
            issue: nil,
            action: nil,
            direction: nil,
            severity: nil
        )
    }

    private static func rank(_ confidence: Confidence) -> Int {
        switch confidence {
        case .low: 0
        case .medium: 1
        case .high: 2
        }
    }
}

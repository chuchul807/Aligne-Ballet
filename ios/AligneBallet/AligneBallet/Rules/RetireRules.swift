import Foundation

enum RetireRules {
    private static let bothLegs: [LandmarkName] = [
        .leftHip, .leftKnee, .leftAnkle, .rightHip, .rightKnee, .rightAnkle,
    ]

    static let all: [Rule] = [
        Rule(
            id: "retire-place-foot-at-knee",
            positions: [.retirePasse],
            requiredMeasurements: [\.workingAnkleToSupportingKnee],
            region: .feet,
            priority: .line,
            evidence: bothLegs
        ) { context in
            guard let amount = RuleMath.above(
                context.measurements.workingAnkleToSupportingKnee.value, 0.32, denominator: 1
            ) else { return nil }
            let evidence = [context.support(.knee), context.working(.ankle)]
            return RuleFinding(
                evidence: evidence,
                annotation: RuleAnnotation.region("retire-place-foot-at-knee", evidence),
                direction: "move the working foot toward the supporting knee",
                severity: amount
            )
        },
        Rule(
            id: "retire-open-working-knee",
            positions: [.retirePasse],
            supportedViews: [.front],
            requiredMeasurements: [\.workingKneeLateralOffset],
            region: .workingLeg,
            priority: .line,
            evidence: [.leftHip, .leftKnee, .rightHip, .rightKnee]
        ) { context in
            guard let amount = RuleMath.below(
                context.measurements.workingKneeLateralOffset.value, 0.28, denominator: 1
            ) else { return nil }
            let evidence = [context.support(.hip), context.working(.knee)]
            return RuleFinding(
                evidence: evidence,
                annotation: RuleAnnotation.region("retire-open-working-knee", evidence),
                direction: "move the working knee outward",
                severity: amount
            )
        },
    ]
}

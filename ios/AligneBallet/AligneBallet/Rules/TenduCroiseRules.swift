import Foundation

enum TenduCroiseRules {
    private static let bothLegs: [LandmarkName] = [
        .leftHip, .leftKnee, .leftAnkle, .rightHip, .rightKnee, .rightAnkle,
    ]
    private static let bothFeet: [LandmarkName] = [
        .leftKnee, .leftAnkle, .leftHeel, .leftFootIndex,
        .rightKnee, .rightAnkle, .rightHeel, .rightFootIndex,
    ]

    static let all: [Rule] = [
        Rule(
            id: "tendu-working-knee-bent",
            positions: [.tenduCroiseDevant],
            supportedViews: [.front],
            requiredMeasurements: [\.workingKneeAngle, \.workingKneeForwardDepthCue],
            region: .workingLeg,
            priority: .line,
            evidence: bothLegs
        ) { context in
            guard let angle = RuleMath.below(context.measurements.workingKneeAngle.value, 155),
                  let depth = RuleMath.above(context.measurements.workingKneeForwardDepthCue.value, 0.03) else {
                return nil
            }
            let evidence = context.workingLeg
            return RuleFinding(
                evidence: evidence,
                annotation: RuleAnnotation.joint("tendu-working-knee-bent", evidence[1]),
                direction: "lengthen and straighten the working leg",
                severity: min(angle, depth)
            )
        },
        Rule(
            id: "tendu-foot-not-pointed",
            positions: [.tenduCroiseDevant],
            supportedViews: [.front],
            requiredMeasurements: [\.workingFootPointAngle],
            region: .feet,
            priority: .line,
            evidence: bothFeet
        ) { context in
            guard let amount = RuleMath.below(
                context.measurements.workingFootPointAngle.value, 150, denominator: 150
            ) else { return nil }
            let evidence = [context.working(.knee), context.working(.ankle), context.working(.footIndex)]
            return RuleFinding(
                evidence: evidence,
                annotation: RuleAnnotation.region("tendu-foot-not-pointed", evidence),
                direction: "lengthen and point the working foot",
                severity: amount
            )
        },
        Rule(
            id: "tendu-working-foot-lifted",
            positions: [.tenduCroiseDevant],
            supportedViews: [.front],
            requiredMeasurements: [\.workingFootHeightFromSupportingFoot],
            region: .feet,
            priority: .line,
            evidence: [.leftFootIndex, .rightFootIndex]
        ) { context in
            guard let amount = RuleMath.above(
                context.measurements.workingFootHeightFromSupportingFoot.value, 0.18, denominator: 1
            ) else { return nil }
            let evidence = [context.support(.footIndex), context.working(.footIndex)]
            return RuleFinding(
                evidence: evidence,
                annotation: RuleAnnotation.region("tendu-working-foot-lifted", evidence),
                direction: "lower the working toes to the floor",
                severity: amount
            )
        },
        Rule(
            id: "tendu-crossing-too-small",
            positions: [.tenduCroiseDevant],
            supportedViews: [.front],
            requiredMeasurements: [\.croiseCrossingSeparation],
            region: .workingLeg,
            priority: .line,
            evidence: [.leftHip, .rightHip, .leftAnkle, .rightAnkle]
        ) { context in
            guard let amount = RuleMath.below(
                context.measurements.croiseCrossingSeparation.value, 0.12, denominator: 1
            ) else { return nil }
            let evidence = [context.support(.ankle), context.working(.ankle)]
            return RuleFinding(
                evidence: evidence,
                annotation: RuleAnnotation.region("tendu-crossing-too-small", evidence),
                direction: "increase the visible croise crossing",
                severity: amount
            )
        },
    ]
}

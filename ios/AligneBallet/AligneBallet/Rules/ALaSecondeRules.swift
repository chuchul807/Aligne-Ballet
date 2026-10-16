import Foundation

enum ALaSecondeRules {
    private static let bothLegs: [LandmarkName] = [
        .leftHip, .leftKnee, .leftAnkle, .rightHip, .rightKnee, .rightAnkle,
    ]
    private static let bothFeet: [LandmarkName] = [
        .leftKnee, .leftAnkle, .leftHeel, .leftFootIndex,
        .rightKnee, .rightAnkle, .rightHeel, .rightFootIndex,
    ]

    static let all: [Rule] = [
        Rule(
            id: "a-la-seconde-working-knee-bent",
            positions: [.aLaSeconde],
            supportedViews: [.front],
            requiredMeasurements: [\.workingKneeAngle, \.workingKneeForwardDepthCue],
            region: .workingLeg,
            priority: .stability,
            evidence: bothLegs
        ) { context in
            guard let angle = RuleMath.below(context.measurements.workingKneeAngle.value, 155),
                  let depth = RuleMath.above(context.measurements.workingKneeForwardDepthCue.value, 0.03) else {
                return nil
            }
            let evidence = context.workingLeg
            return RuleFinding(
                evidence: evidence,
                annotation: RuleAnnotation.joint("a-la-seconde-working-knee-bent", evidence[1]),
                direction: "lengthen and straighten the working leg",
                severity: min(angle, depth)
            )
        },
        Rule(
            id: "a-la-seconde-working-leg-not-side",
            positions: [.aLaSeconde],
            supportedViews: [.front],
            requiredMeasurements: [\.workingAnkleOutwardOffset, \.workingAnkleHeightFromHip],
            region: .workingLeg,
            priority: .line,
            evidence: bothLegs
        ) { context in
            guard let height = context.measurements.workingAnkleHeightFromHip.value else { return nil }
            let extraHeight = max(0, max(0, height) - 0.50)
            let requiredOutward = max(-0.05, 0.08 - extraHeight * 0.16)
            guard let amount = RuleMath.below(
                context.measurements.workingAnkleOutwardOffset.value,
                requiredOutward,
                denominator: max(1, requiredOutward)
            ) else { return nil }
            let evidence = context.workingLeg
            return RuleFinding(
                evidence: evidence,
                annotation: RuleAnnotation.region("a-la-seconde-working-leg-not-side", evidence),
                direction: "move the working leg into the side plane",
                severity: amount
            )
        },
        Rule(
            id: "a-la-seconde-foot-not-pointed",
            positions: [.aLaSeconde],
            supportedViews: [.front],
            requiredMeasurements: [\.workingFootPointAngle],
            region: .feet,
            priority: .structure,
            evidence: bothFeet
        ) { context in
            guard let amount = RuleMath.below(
                context.measurements.workingFootPointAngle.value, 150, denominator: 150
            ) else { return nil }
            let evidence = [context.working(.knee), context.working(.ankle), context.working(.footIndex)]
            return RuleFinding(
                evidence: evidence,
                annotation: RuleAnnotation.region("a-la-seconde-foot-not-pointed", evidence),
                direction: "lengthen and point the working foot",
                severity: amount
            )
        },
        Rule(
            id: "a-la-seconde-turnout-not-visible",
            positions: [.aLaSeconde],
            supportedViews: [.front],
            requiredMeasurements: [\.workingHeelVisibilityCue],
            region: .feet,
            priority: .structure,
            evidence: bothFeet
        ) { context in
            guard let amount = RuleMath.below(
                context.measurements.workingHeelVisibilityCue.value, 0.05, denominator: 1
            ) else { return nil }
            let evidence = [context.working(.heel), context.working(.footIndex)]
            return RuleFinding(
                evidence: evidence,
                annotation: RuleAnnotation.region("a-la-seconde-turnout-not-visible", evidence),
                direction: "show a clearer turned-out heel line",
                severity: amount
            )
        },
        Rule(
            id: "a-la-seconde-pelvis-out-of-line",
            dedupeKey: "pelvis-level",
            positions: [.aLaSeconde],
            supportedViews: [.front],
            requiredMeasurements: [\.pelvisSlope, \.workingAnkleHeightFromHip, \.workingAnkleOutwardOffset],
            region: .pelvis,
            priority: .line,
            evidence: [.leftHip, .rightHip, .leftAnkle, .rightAnkle]
        ) { context in
            guard let height = context.measurements.workingAnkleHeightFromHip.value,
                  let outwardValue = context.measurements.workingAnkleOutwardOffset.value,
                  let slope = context.measurements.pelvisSlope.value else { return nil }
            let outward = max(0.01, abs(outwardValue))
            let heightToOutward = height / outward
            let approachingHorizontal = RuleMath.clamp01(1 + heightToOutward)
            let aboveHorizontal = RuleMath.clamp01(heightToOutward)
            let allowedSlope = 12 + (25 - 12) * approachingHorizontal + (30 - 25) * aboveHorizontal
            guard let amount = RuleMath.above(abs(slope), allowedSlope) else { return nil }
            let evidence: [LandmarkName] = [.leftHip, .rightHip, context.working(.ankle)]
            return RuleFinding(
                evidence: evidence,
                annotation: RuleAnnotation.region("a-la-seconde-pelvis-out-of-line", evidence),
                direction: "restore the visible pelvic line",
                severity: amount
            )
        },
    ]
}

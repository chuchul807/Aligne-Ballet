import Foundation

enum AttitudeRules {
    private static let bothLegs: [LandmarkName] = [
        .leftHip, .leftKnee, .leftAnkle, .rightHip, .rightKnee, .rightAnkle,
    ]

    static let all: [Rule] = [
        Rule(
            id: "attitude-working-knee-too-straight",
            positions: [.attitudeDerriere],
            requiredMeasurements: [\.workingKneeAngle],
            region: .workingLeg,
            priority: .line,
            evidence: bothLegs
        ) { context in
            guard let amount = RuleMath.above(
                context.measurements.workingKneeAngle.value, 145, denominator: 145
            ) else { return nil }
            let evidence = context.workingLeg
            return RuleFinding(
                evidence: evidence,
                annotation: RuleAnnotation.joint("attitude-working-knee-too-straight", evidence[1]),
                direction: "bend the working knee behind",
                severity: amount
            )
        },
        Rule(
            id: "attitude-working-knee-too-closed",
            positions: [.attitudeDerriere],
            requiredMeasurements: [\.workingKneeAngle],
            region: .workingLeg,
            priority: .line,
            evidence: bothLegs
        ) { context in
            guard let amount = RuleMath.below(
                context.measurements.workingKneeAngle.value, 65, denominator: 65
            ) else { return nil }
            let evidence = context.workingLeg
            return RuleFinding(
                evidence: evidence,
                annotation: RuleAnnotation.joint("attitude-working-knee-too-closed", evidence[1]),
                direction: "open the working-knee bend slightly",
                severity: amount
            )
        },
        Rule(
            id: "attitude-level-pelvis",
            positions: [.attitudeDerriere],
            requiredMeasurements: [\.workingAnkleHeightFromHip, \.pelvisSlope],
            region: .pelvis,
            priority: .structure,
            evidence: [.leftHip, .rightHip, .leftAnkle, .rightAnkle]
        ) { context in
            guard let height = RuleMath.above(context.measurements.workingAnkleHeightFromHip.value, 0, denominator: 1),
                  let slopeValue = context.measurements.pelvisSlope.value,
                  let slope = RuleMath.above(abs(slopeValue), 10, denominator: 10) else { return nil }
            let evidence: [LandmarkName] = [.leftHip, .rightHip, context.working(.ankle)]
            return RuleFinding(
                evidence: evidence,
                annotation: RuleAnnotation.region("attitude-level-pelvis", evidence),
                direction: "level the pelvis",
                severity: max(height, slope)
            )
        },
        Rule(
            id: "attitude-lift-thigh",
            positions: [.attitudeDerriere],
            requiredMeasurements: [\.workingKneeHeightFromHip, \.pelvisSlope],
            region: .workingLeg,
            priority: .line,
            evidence: [.leftHip, .leftKnee, .rightHip, .rightKnee]
        ) { context in
            guard let amount = RuleMath.below(
                context.measurements.workingKneeHeightFromHip.value, -0.25, denominator: 1
            ), let slope = context.measurements.pelvisSlope.value, abs(slope) <= 8 else { return nil }
            let evidence = [context.working(.hip), context.working(.knee)]
            return RuleFinding(
                evidence: evidence,
                annotation: RuleAnnotation.region("attitude-lift-thigh", evidence),
                direction: "lift the working thigh slightly",
                severity: amount
            )
        },
    ]
}

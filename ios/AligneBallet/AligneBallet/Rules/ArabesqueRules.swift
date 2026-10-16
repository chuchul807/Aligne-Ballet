import Foundation

enum ArabesqueRules {
    private static let bothLegs: [LandmarkName] = [
        .leftHip, .leftKnee, .leftAnkle, .rightHip, .rightKnee, .rightAnkle,
    ]

    static let all: [Rule] = [
        Rule(
            id: "arabesque-working-knee-bent",
            positions: [.arabesque],
            requiredMeasurements: [\.workingKneeAngle],
            region: .workingLeg,
            priority: .line,
            evidence: bothLegs
        ) { context in
            guard let amount = RuleMath.below(context.measurements.workingKneeAngle.value, 165) else {
                return nil
            }
            let evidence = context.workingLeg
            return RuleFinding(
                evidence: evidence,
                annotation: RuleAnnotation.joint("arabesque-working-knee-bent", evidence[1]),
                direction: "lengthen and straighten the working leg",
                severity: amount
            )
        },
        Rule(
            id: "arabesque-lower-leg-for-pelvis",
            positions: [.arabesque],
            requiredMeasurements: [\.workingAnkleHeightFromHip, \.pelvisSlope],
            region: .pelvis,
            priority: .structure,
            evidence: [.leftHip, .rightHip, .leftAnkle, .rightAnkle]
        ) { context in
            guard let height = RuleMath.above(context.measurements.workingAnkleHeightFromHip.value, 0),
                  let pelvis = context.measurements.pelvisSlope.value,
                  let slope = RuleMath.above(abs(pelvis), 10) else { return nil }
            let evidence: [LandmarkName] = [.leftHip, .rightHip, context.working(.ankle)]
            return RuleFinding(
                evidence: evidence,
                annotation: RuleAnnotation.region("arabesque-lower-leg-for-pelvis", evidence),
                direction: "lower the working leg slightly and re-level the pelvis",
                severity: max(height, slope)
            )
        },
        Rule(
            id: "arabesque-working-leg-too-low",
            positions: [.arabesque],
            requiredMeasurements: [\.workingAnkleHeightFromHip, \.pelvisSlope],
            region: .workingLeg,
            priority: .line,
            evidence: bothLegs
        ) { context in
            guard let amount = RuleMath.below(
                context.measurements.workingAnkleHeightFromHip.value,
                -0.30,
                denominator: 0.30
            ), let slope = context.measurements.pelvisSlope.value, abs(slope) <= 8 else {
                return nil
            }
            let evidence = context.workingLeg
            return RuleFinding(
                evidence: evidence,
                annotation: RuleAnnotation.region("arabesque-working-leg-too-low", evidence),
                direction: "lengthen the working leg back and slightly upward without changing the pelvis",
                severity: amount
            )
        },
        Rule(
            id: "arabesque-torso-collapse",
            positions: [.arabesque],
            requiredMeasurements: [\.torsoLateralOffset],
            region: .torso,
            priority: .structure,
            evidence: [.leftShoulder, .rightShoulder, .leftHip, .rightHip]
        ) { context in
            guard let amount = RuleMath.below(
                context.measurements.torsoLateralOffset.value,
                -0.18,
                denominator: 0.18
            ) else { return nil }
            let evidence: [LandmarkName] = [.leftShoulder, .rightShoulder, .leftHip, .rightHip]
            return RuleFinding(
                evidence: evidence,
                annotation: RuleAnnotation.region("arabesque-torso-collapse", evidence),
                direction: "lengthen the torso forward and upward",
                severity: amount
            )
        },
    ]
}

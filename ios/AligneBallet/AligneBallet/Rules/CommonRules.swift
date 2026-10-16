import Foundation

enum CommonRules {
    static let all: [Rule] = [
        Rule(
            id: "supporting-knee-bent",
            requiredMeasurements: [\.supportingKneeAngle],
            region: .supportingLeg,
            priority: .stability,
            evidence: [.leftHip, .leftKnee, .leftAnkle]
        ) { context in
            let front = context.view == .front
            let angleLimit = front ? 155.0 : 165.0
            guard let angle = RuleMath.below(context.measurements.supportingKneeAngle.value, angleLimit) else {
                return nil
            }
            let evidence = context.supportingLeg
            if front {
                let depthCue = context.measurements.supportingKneeForwardDepthCue
                guard depthCue.assessability == .assessable, let depth = depthCue.value else {
                    return RuleFinding(
                        evidence: evidence,
                        direction: "",
                        severity: 0,
                        assessability: .unassessable
                    )
                }
                guard let depthAmount = RuleMath.above(depth, 0.03) else { return nil }
                return RuleFinding(
                    evidence: evidence,
                    direction: "lengthen the supporting leg",
                    severity: min(angle, depthAmount)
                )
            }
            return RuleFinding(evidence: evidence, direction: "lengthen the supporting leg", severity: angle)
        },
        Rule(
            id: "pelvis-unlevel",
            dedupeKey: "pelvis-level",
            positions: [.arabesque, .attitudeDerriere, .retirePasse, .tenduCroiseDevant],
            requiredMeasurements: [\.pelvisSlope],
            region: .pelvis,
            priority: .structure,
            evidence: [.leftHip, .rightHip]
        ) { context in
            guard let value = context.measurements.pelvisSlope.value,
                  let amount = RuleMath.above(abs(value), 8) else { return nil }
            return RuleFinding(evidence: [.leftHip, .rightHip], direction: "level the pelvis", severity: amount)
        },
        Rule(
            id: "shoulders-unlevel",
            requiredMeasurements: [\.shoulderSlope],
            region: .shouldersArms,
            priority: .line,
            evidence: [.leftShoulder, .rightShoulder]
        ) { context in
            guard let value = context.measurements.shoulderSlope.value,
                  let amount = RuleMath.above(abs(value), 10) else { return nil }
            return RuleFinding(
                evidence: [.leftShoulder, .rightShoulder],
                direction: "lower the raised shoulder",
                severity: amount
            )
        },
        Rule(
            id: "torso-off-support",
            requiredMeasurements: [\.torsoLateralOffset],
            region: .torso,
            priority: .stability,
            evidence: [.leftShoulder, .rightShoulder, .leftHip, .rightHip]
        ) { context in
            let isSecond = context.position == .aLaSeconde
            let threshold = isSecond ? 0.28 : 0.12
            guard let value = context.measurements.torsoLateralOffset.value,
                  let amount = RuleMath.above(abs(value), threshold) else { return nil }
            return RuleFinding(
                evidence: [.leftShoulder, .rightShoulder, .leftHip, .rightHip],
                direction: "bring the torso toward the supporting side",
                severity: amount,
                priority: isSecond ? .line : .stability
            )
        },
        Rule(
            id: "supporting-lateral-offset",
            dedupeKey: "supporting-lateral-alignment",
            supportedViews: [.front],
            requiredMeasurements: [\.frontalSupportingHipAnkleOffset],
            region: .supportingLeg,
            priority: .stability,
            evidence: [.leftHip, .leftAnkle, .rightHip, .rightAnkle]
        ) { context in
            let isSecond = context.position == .aLaSeconde
            let threshold = isSecond ? 0.35 : 0.18
            guard let amount = RuleMath.above(
                context.measurements.frontalSupportingHipAnkleOffset.value,
                threshold
            ) else { return nil }
            return RuleFinding(
                evidence: [context.support(.hip), context.support(.ankle)],
                direction: "bring the supporting hip and ankle into closer side-to-side alignment",
                severity: amount,
                priority: isSecond ? .line : .stability
            )
        },
        Rule(
            id: "left-arm-line-collapsed",
            requiredMeasurements: [\.leftElbowAngle],
            region: .shouldersArms,
            priority: .line,
            evidence: [.leftShoulder, .leftElbow, .leftWrist]
        ) { context in
            guard let amount = RuleMath.below(context.measurements.leftElbowAngle.value, 110) else {
                return nil
            }
            return RuleFinding(
                evidence: [.leftShoulder, .leftElbow, .leftWrist],
                direction: "lengthen the left arm",
                severity: amount
            )
        },
        Rule(
            id: "right-arm-line-collapsed",
            requiredMeasurements: [\.rightElbowAngle],
            region: .shouldersArms,
            priority: .line,
            evidence: [.rightShoulder, .rightElbow, .rightWrist]
        ) { context in
            guard let amount = RuleMath.below(context.measurements.rightElbowAngle.value, 110) else {
                return nil
            }
            return RuleFinding(
                evidence: [.rightShoulder, .rightElbow, .rightWrist],
                direction: "lengthen the right arm",
                severity: amount
            )
        },
        Rule(
            id: "head-extreme-lateral-tilt",
            requiredMeasurements: [\.headTiltFromTorso],
            region: .head,
            priority: .line,
            evidence: [.nose, .leftShoulder, .rightShoulder, .leftHip, .rightHip]
        ) { context in
            guard let amount = RuleMath.above(context.measurements.headTiltFromTorso.value, 25) else {
                return nil
            }
            return RuleFinding(
                evidence: [.nose, .leftShoulder, .rightShoulder, .leftHip, .rightHip],
                direction: "bring the head toward the torso axis",
                severity: amount
            )
        },
    ]
}

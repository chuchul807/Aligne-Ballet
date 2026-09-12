import type { LandmarkName } from '../domain/landmarks';
import type { Observation, Priority, BodyRegion, ViewType } from '../domain/types';
import type { Rule, RuleContext } from './types';

export interface CommonRuleTolerances {
  supportingKneeClearBelowDegrees: number;
  pelvisSlopeAboveDegrees: number;
  shoulderSlopeAboveDegrees: number;
  torsoLateralOffsetAboveTorsoRatio: number;
  supportingHipAnkleOffsetAboveTorsoRatio: number;
  armElbowBelowDegrees: number;
  headTiltAboveDegrees: number;
}

export interface ConservativeRuleConfiguration {
  common: CommonRuleTolerances;
  arabesque: {
    workingKneeClearBelowDegrees: number;
    pelvisCompensationWorkingAnkleAboveHipRatio: number;
    pelvisCompensationSlopeAboveDegrees: number;
    workingLegLowBelowHipRatio: number;
    maxPelvisSlopeForLegHeightDegrees: number;
    torsoCollapseBelowSupportRatio: number;
  };
  attitude: {
    workingKneeStraightAboveDegrees: number;
    workingKneeClosedBelowDegrees: number;
    pelvisCompensationWorkingAnkleAboveHipRatio: number;
    pelvisCompensationSlopeAboveDegrees: number;
    workingThighLowBelowHipRatio: number;
    maxPelvisSlopeForThighHeightDegrees: number;
  };
  retire: {
    workingFootDistanceAboveTorsoRatio: number;
    workingKneeLateralOffsetBelowTorsoRatio: number;
  };
}

export const CONSERVATIVE_RULE_CONFIGURATION = {
  common: {
    supportingKneeClearBelowDegrees: 165,
    pelvisSlopeAboveDegrees: 8,
    shoulderSlopeAboveDegrees: 10,
    torsoLateralOffsetAboveTorsoRatio: 0.12,
    supportingHipAnkleOffsetAboveTorsoRatio: 0.18,
    armElbowBelowDegrees: 110,
    headTiltAboveDegrees: 25,
  },
  arabesque: {
    workingKneeClearBelowDegrees: 165,
    pelvisCompensationWorkingAnkleAboveHipRatio: 0,
    pelvisCompensationSlopeAboveDegrees: 10,
    workingLegLowBelowHipRatio: -0.30,
    maxPelvisSlopeForLegHeightDegrees: 8,
    torsoCollapseBelowSupportRatio: -0.18,
  },
  attitude: {
    workingKneeStraightAboveDegrees: 145,
    workingKneeClosedBelowDegrees: 65,
    pelvisCompensationWorkingAnkleAboveHipRatio: 0,
    pelvisCompensationSlopeAboveDegrees: 10,
    workingThighLowBelowHipRatio: -0.25,
    maxPelvisSlopeForThighHeightDegrees: 8,
  },
  retire: {
    workingFootDistanceAboveTorsoRatio: 0.32,
    workingKneeLateralOffsetBelowTorsoRatio: 0.28,
  },
} as const satisfies ConservativeRuleConfiguration;

const allPositions = ['arabesque', 'attitude-derriere', 'retire-passe'] as const;

function finding(
  id: string,
  region: BodyRegion,
  priority: Priority,
  evidence: readonly LandmarkName[],
  issue: string,
  action: string,
  direction: string,
  severity: number,
): Observation {
  return {
    id,
    ruleId: id,
    dedupeKey: id,
    region,
    priority,
    confidence: 'low',
    evidence,
    annotation: [],
    assessability: 'assessable',
    issue,
    action,
    direction,
    severity,
  };
}

function above(value: number, threshold: number): number | null {
  return Number.isFinite(value) && value > threshold ? (value - threshold) / Math.max(1 - threshold, threshold) : null;
}

function below(value: number, threshold: number): number | null {
  return Number.isFinite(value) && value < threshold ? (threshold - value) / threshold : null;
}

function signedSlope(value: number): number | null {
  return !Number.isFinite(value) ? null : Math.abs(value);
}

function rule(
  id: string,
  region: BodyRegion,
  priority: Priority,
  requiredMeasurements: Rule['requiredMeasurements'],
  evidence: readonly LandmarkName[],
  evaluate: (context: RuleContext) => Observation | null,
  options: { dedupeKey?: string; supportedViews?: readonly ViewType[] } = {},
): Rule {
  return {
    id,
    dedupeKey: options.dedupeKey ?? id,
    positions: allPositions,
    requiredMeasurements,
    region,
    priority,
    evidence,
    evaluate,
    ...(options.supportedViews ? { supportedViews: options.supportedViews } : {}),
  };
}

export function createCommonRules(config: CommonRuleTolerances): readonly Rule[] {
  return [
  rule('supporting-knee-bent', 'supporting-leg', 'stability', ['supportingKneeAngle'], ['left_hip', 'left_knee', 'left_ankle'], (context) => {
    const amount = below(context.measurements.supportingKneeAngle.value!, config.supportingKneeClearBelowDegrees);
    return amount === null ? null : finding('supporting-knee-bent', 'supporting-leg', 'stability', context.supportingSide === 'left' ? ['left_hip', 'left_knee', 'left_ankle'] : ['right_hip', 'right_knee', 'right_ankle'], 'The supporting knee is visibly bent.', 'Straighten the supporting knee.', 'lengthen the supporting leg', amount);
  }),
  rule('pelvis-unlevel', 'pelvis', 'structure', ['pelvisSlope'], ['left_hip', 'right_hip'], (context) => {
    const amount = above(signedSlope(context.measurements.pelvisSlope.value!)!, config.pelvisSlopeAboveDegrees);
    return amount === null ? null : finding('pelvis-unlevel', 'pelvis', 'structure', ['left_hip', 'right_hip'], 'The pelvis is visibly unlevel.', 'Level the pelvis.', 'level the pelvis', amount);
  }, { dedupeKey: 'pelvis-level' }),
  rule('shoulders-unlevel', 'shoulders-arms', 'line', ['shoulderSlope'], ['left_shoulder', 'right_shoulder'], (context) => {
    const amount = above(signedSlope(context.measurements.shoulderSlope.value!)!, config.shoulderSlopeAboveDegrees);
    return amount === null ? null : finding('shoulders-unlevel', 'shoulders-arms', 'line', ['left_shoulder', 'right_shoulder'], 'The shoulders are visibly unlevel.', 'Soften the raised shoulder downward.', 'lower the raised shoulder', amount);
  }),
  rule('torso-off-support', 'torso', 'stability', ['torsoLateralOffset'], ['left_shoulder', 'right_shoulder', 'left_hip', 'right_hip'], (context) => {
    const amount = above(Math.abs(context.measurements.torsoLateralOffset.value!), config.torsoLateralOffsetAboveTorsoRatio);
    return amount === null ? null : finding('torso-off-support', 'torso', 'stability', ['left_shoulder', 'right_shoulder', 'left_hip', 'right_hip'], 'The torso is off the supporting side.', 'Bring the torso back over the supporting side.', 'bring the torso toward the supporting side', amount);
  }),
  rule('supporting-lateral-offset', 'supporting-leg', 'stability', ['frontalSupportingHipAnkleOffset'], ['left_hip', 'left_ankle', 'right_hip', 'right_ankle'], (context) => {
    const amount = above(context.measurements.frontalSupportingHipAnkleOffset.value!, config.supportingHipAnkleOffsetAboveTorsoRatio);
    const evidence = context.supportingSide === 'left' ? ['left_hip', 'left_ankle'] as const : ['right_hip', 'right_ankle'] as const;
    return amount === null ? null : finding('supporting-lateral-offset', 'supporting-leg', 'stability', evidence, 'From the front view, the supporting hip and ankle are visibly offset side to side.', 'Bring the supporting hip and ankle into closer side-to-side alignment.', 'bring the supporting hip and ankle into closer side-to-side alignment', amount);
  }, { dedupeKey: 'supporting-lateral-alignment', supportedViews: ['front'] }),
  rule('left-arm-line-collapsed', 'shoulders-arms', 'line', ['leftElbowAngle'], ['left_shoulder', 'left_elbow', 'left_wrist'], (context) => {
    const amount = below(context.measurements.leftElbowAngle.value!, config.armElbowBelowDegrees);
    return amount === null ? null : finding('left-arm-line-collapsed', 'shoulders-arms', 'line', ['left_shoulder', 'left_elbow', 'left_wrist'], 'The left elbow line is collapsed.', 'Lengthen through the left elbow.', 'lengthen the left arm', amount);
  }),
  rule('right-arm-line-collapsed', 'shoulders-arms', 'line', ['rightElbowAngle'], ['right_shoulder', 'right_elbow', 'right_wrist'], (context) => {
    const amount = below(context.measurements.rightElbowAngle.value!, config.armElbowBelowDegrees);
    return amount === null ? null : finding('right-arm-line-collapsed', 'shoulders-arms', 'line', ['right_shoulder', 'right_elbow', 'right_wrist'], 'The right elbow line is collapsed.', 'Lengthen through the right elbow.', 'lengthen the right arm', amount);
  }),
  rule('head-extreme-lateral-tilt', 'head', 'line', ['headTiltFromTorso'], ['nose', 'left_shoulder', 'right_shoulder', 'left_hip', 'right_hip'], (context) => {
    const amount = above(context.measurements.headTiltFromTorso.value!, config.headTiltAboveDegrees);
    return amount === null ? null : finding('head-extreme-lateral-tilt', 'head', 'line', ['nose', 'left_shoulder', 'right_shoulder', 'left_hip', 'right_hip'], 'The head is tilted far from the torso axis.', 'Bring the head back in line with the torso.', 'bring the head toward the torso axis', amount);
  }),
  ];
}

export const COMMON_RULES = createCommonRules(CONSERVATIVE_RULE_CONFIGURATION.common);

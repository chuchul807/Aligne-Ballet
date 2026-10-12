import type { LandmarkName } from '../domain/landmarks';
import type { Observation, Priority, BodyRegion, ViewType } from '../domain/types';
import type { Rule, RuleContext } from './types';

export interface CommonRuleTolerances {
  supportingKneeClearBelowDegrees: number;
  frontalKneeClearlyBentBelowDegrees: number;
  frontalKneeForwardDepthAboveBodyWidthRatio: number;
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
  aLaSeconde: {
    workingKneeClearBelowDegrees: number;
    workingFootPointBelowDegrees: number;
    workingHeelVisibilityBelowBodyWidthRatio: number;
    workingAnkleOutwardOffsetBelowTorsoRatio: number;
    torsoLateralOffsetAboveTorsoRatio: number;
    supportingHipAnkleOffsetAboveTorsoRatio: number;
    verticalAllowanceStartsAboveHipRatio: number;
    outwardAllowancePerTorsoHeight: number;
    minimumHighLegOutwardOffsetRatio: number;
    basePelvisSlopeDegrees: number;
    nearHorizontalPelvisSlopeDegrees: number;
    maximumPelvisSlopeDegrees: number;
  };
  tenduCroiseDevant: {
    workingKneeClearBelowDegrees: number;
    workingFootPointBelowDegrees: number;
    workingFootHeightAboveTorsoRatio: number;
    crossingSeparationBelowTorsoRatio: number;
  };
}

export const CONSERVATIVE_RULE_CONFIGURATION = {
  common: {
    supportingKneeClearBelowDegrees: 165,
    frontalKneeClearlyBentBelowDegrees: 155,
    frontalKneeForwardDepthAboveBodyWidthRatio: 0.03,
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
  aLaSeconde: {
    workingKneeClearBelowDegrees: 165,
    workingFootPointBelowDegrees: 150,
    workingHeelVisibilityBelowBodyWidthRatio: 0.05,
    workingAnkleOutwardOffsetBelowTorsoRatio: 0.08,
    torsoLateralOffsetAboveTorsoRatio: 0.28,
    supportingHipAnkleOffsetAboveTorsoRatio: 0.35,
    verticalAllowanceStartsAboveHipRatio: 0.50,
    outwardAllowancePerTorsoHeight: 0.16,
    minimumHighLegOutwardOffsetRatio: -0.05,
    basePelvisSlopeDegrees: 12,
    nearHorizontalPelvisSlopeDegrees: 25,
    maximumPelvisSlopeDegrees: 30,
  },
  tenduCroiseDevant: {
    workingKneeClearBelowDegrees: 165,
    workingFootPointBelowDegrees: 150,
    workingFootHeightAboveTorsoRatio: 0.18,
    crossingSeparationBelowTorsoRatio: 0.12,
  },
} as const satisfies ConservativeRuleConfiguration;

const allPositions = [
  'arabesque',
  'attitude-derriere',
  'retire-passe',
  'a-la-seconde',
  'tendu-croise-devant',
] as const;
const standardPelvisPositions = [
  'arabesque',
  'attitude-derriere',
  'retire-passe',
  'tendu-croise-devant',
] as const;

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

function unassessableFinding(
  id: string,
  region: BodyRegion,
  priority: Priority,
  evidence: readonly LandmarkName[],
): Observation {
  return {
    id, ruleId: id, dedupeKey: id, region, priority, confidence: 'low', evidence,
    annotation: [], assessability: 'unassessable', issue: null, action: null, direction: null, severity: null,
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
  options: { dedupeKey?: string; supportedViews?: readonly ViewType[]; positions?: Rule['positions'] } = {},
): Rule {
  return {
    id,
    dedupeKey: options.dedupeKey ?? id,
    positions: options.positions ?? allPositions,
    requiredMeasurements,
    region,
    priority,
    evidence,
    evaluate,
    ...(options.supportedViews ? { supportedViews: options.supportedViews } : {}),
  };
}

export function createCommonRules(config: CommonRuleTolerances): readonly Rule[] {
  const aLaSecondeAlignment = CONSERVATIVE_RULE_CONFIGURATION.aLaSeconde;
  return [
  rule('supporting-knee-bent', 'supporting-leg', 'stability', ['supportingKneeAngle'], ['left_hip', 'left_knee', 'left_ankle'], (context) => {
    const isFrontView = context.view === 'front';
    const angleThreshold = isFrontView
      ? config.frontalKneeClearlyBentBelowDegrees
      : config.supportingKneeClearBelowDegrees;
    const angleAmount = below(context.measurements.supportingKneeAngle.value!, angleThreshold);
    if (angleAmount === null) return null;
    let amount = angleAmount;
    if (isFrontView) {
      const depthCue = context.measurements.supportingKneeForwardDepthCue;
      if (depthCue.assessability !== 'assessable' || depthCue.value === null) {
        const evidence = context.supportingSide === 'left'
          ? ['left_hip', 'left_knee', 'left_ankle'] as const
          : ['right_hip', 'right_knee', 'right_ankle'] as const;
        return unassessableFinding('supporting-knee-bent', 'supporting-leg', 'stability', evidence);
      }
      const depthAmount = above(depthCue.value, config.frontalKneeForwardDepthAboveBodyWidthRatio);
      if (depthAmount === null) return null;
      amount = Math.min(angleAmount, depthAmount);
    }
    return amount === null ? null : finding('supporting-knee-bent', 'supporting-leg', 'stability', context.supportingSide === 'left' ? ['left_hip', 'left_knee', 'left_ankle'] : ['right_hip', 'right_knee', 'right_ankle'], 'The supporting knee is visibly bent.', 'Straighten the supporting knee.', 'lengthen the supporting leg', amount);
  }),
  rule('pelvis-unlevel', 'pelvis', 'structure', ['pelvisSlope'], ['left_hip', 'right_hip'], (context) => {
    const amount = above(signedSlope(context.measurements.pelvisSlope.value!)!, config.pelvisSlopeAboveDegrees);
    return amount === null ? null : finding('pelvis-unlevel', 'pelvis', 'structure', ['left_hip', 'right_hip'], 'The pelvis is visibly unlevel.', 'Level the pelvis.', 'level the pelvis', amount);
  }, { dedupeKey: 'pelvis-level', positions: standardPelvisPositions }),
  rule('shoulders-unlevel', 'shoulders-arms', 'line', ['shoulderSlope'], ['left_shoulder', 'right_shoulder'], (context) => {
    const amount = above(signedSlope(context.measurements.shoulderSlope.value!)!, config.shoulderSlopeAboveDegrees);
    return amount === null ? null : finding('shoulders-unlevel', 'shoulders-arms', 'line', ['left_shoulder', 'right_shoulder'], 'The shoulders are visibly unlevel.', 'Soften the raised shoulder downward.', 'lower the raised shoulder', amount);
  }),
  rule('torso-off-support', 'torso', 'stability', ['torsoLateralOffset'], ['left_shoulder', 'right_shoulder', 'left_hip', 'right_hip'], (context) => {
    const isALaSeconde = context.position === 'a-la-seconde';
    const threshold = isALaSeconde
      ? aLaSecondeAlignment.torsoLateralOffsetAboveTorsoRatio
      : config.torsoLateralOffsetAboveTorsoRatio;
    const amount = above(Math.abs(context.measurements.torsoLateralOffset.value!), threshold);
    return amount === null ? null : finding('torso-off-support', 'torso', isALaSeconde ? 'line' : 'stability', ['left_shoulder', 'right_shoulder', 'left_hip', 'right_hip'], 'The torso is off the supporting side.', 'Bring the torso back over the supporting side.', 'bring the torso toward the supporting side', amount);
  }),
  rule('supporting-lateral-offset', 'supporting-leg', 'stability', ['frontalSupportingHipAnkleOffset'], ['left_hip', 'left_ankle', 'right_hip', 'right_ankle'], (context) => {
    const isALaSeconde = context.position === 'a-la-seconde';
    const threshold = isALaSeconde
      ? aLaSecondeAlignment.supportingHipAnkleOffsetAboveTorsoRatio
      : config.supportingHipAnkleOffsetAboveTorsoRatio;
    const amount = above(context.measurements.frontalSupportingHipAnkleOffset.value!, threshold);
    const evidence = context.supportingSide === 'left' ? ['left_hip', 'left_ankle'] as const : ['right_hip', 'right_ankle'] as const;
    return amount === null ? null : finding('supporting-lateral-offset', 'supporting-leg', isALaSeconde ? 'line' : 'stability', evidence, 'From the front view, the supporting hip and ankle are visibly offset side to side.', 'Bring the supporting hip and ankle into closer side-to-side alignment.', 'bring the supporting hip and ankle into closer side-to-side alignment', amount);
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

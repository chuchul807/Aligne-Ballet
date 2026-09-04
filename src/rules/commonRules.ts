import type { LandmarkName } from '../domain/landmarks';
import type { Observation, Priority, BodyRegion } from '../domain/types';
import type { Rule, RuleContext } from './types';

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

function signedSlope(value: number | null): number | null {
  return value === null || !Number.isFinite(value) ? null : Math.abs(value);
}

function rule(
  id: string,
  region: BodyRegion,
  priority: Priority,
  requiredMeasurements: Rule['requiredMeasurements'],
  evidence: readonly LandmarkName[],
  evaluate: (context: RuleContext) => Observation | null,
): Rule {
  return { id, positions: allPositions, requiredMeasurements, region, priority, evidence, evaluate };
}

export const COMMON_RULES: readonly Rule[] = [
  rule('supporting-knee-bent', 'supporting-leg', 'stability', ['supportingKneeAngle'], ['left_hip', 'left_knee', 'left_ankle'], (context) => {
    const amount = below(context.measurements.supportingKneeAngle!, 172);
    return amount === null ? null : finding('supporting-knee-bent', 'supporting-leg', 'stability', context.supportingSide === 'left' ? ['left_hip', 'left_knee', 'left_ankle'] : ['right_hip', 'right_knee', 'right_ankle'], 'The supporting knee is visibly bent.', 'Straighten the supporting knee.', 'lengthen the supporting leg', amount);
  }),
  rule('pelvis-unlevel', 'pelvis', 'structure', ['pelvisSlope'], ['left_hip', 'right_hip'], (context) => {
    const amount = above(signedSlope(context.measurements.pelvisSlope)!, 8);
    return amount === null ? null : finding('pelvis-unlevel', 'pelvis', 'structure', ['left_hip', 'right_hip'], 'The pelvis is visibly unlevel.', 'Level the pelvis.', 'level the pelvis', amount);
  }),
  rule('shoulders-unlevel', 'shoulders-arms', 'line', ['shoulderSlope'], ['left_shoulder', 'right_shoulder'], (context) => {
    const amount = above(signedSlope(context.measurements.shoulderSlope)!, 10);
    return amount === null ? null : finding('shoulders-unlevel', 'shoulders-arms', 'line', ['left_shoulder', 'right_shoulder'], 'The shoulders are visibly unlevel.', 'Soften the raised shoulder downward.', 'lower the raised shoulder', amount);
  }),
  rule('torso-off-support', 'torso', 'stability', ['torsoLateralOffset'], ['left_shoulder', 'right_shoulder', 'left_hip', 'right_hip'], (context) => {
    const amount = above(Math.abs(context.measurements.torsoLateralOffset!), 0.12);
    return amount === null ? null : finding('torso-off-support', 'torso', 'stability', ['left_shoulder', 'right_shoulder', 'left_hip', 'right_hip'], 'The torso is off the supporting side.', 'Bring the torso back over the supporting side.', 'bring the torso toward the supporting side', amount);
  }),
  rule('supporting-ankle-not-stacked', 'supporting-leg', 'stability', ['supportingAnkleUnderHipOffset'], ['left_hip', 'left_ankle'], (context) => {
    const amount = above(context.measurements.supportingAnkleUnderHipOffset!, 0.18);
    const evidence = context.supportingSide === 'left' ? ['left_hip', 'left_ankle'] as const : ['right_hip', 'right_ankle'] as const;
    return amount === null ? null : finding('supporting-ankle-not-stacked', 'supporting-leg', 'stability', evidence, 'The supporting hip is not stacked over the ankle.', 'Stack the supporting hip over the ankle.', 'bring the supporting hip over the ankle', amount);
  }),
  rule('left-arm-line-collapsed', 'shoulders-arms', 'line', ['leftElbowAngle'], ['left_shoulder', 'left_elbow', 'left_wrist'], (context) => {
    const amount = below(context.measurements.leftElbowAngle!, 110);
    return amount === null ? null : finding('left-arm-line-collapsed', 'shoulders-arms', 'line', ['left_shoulder', 'left_elbow', 'left_wrist'], 'The left elbow line is collapsed.', 'Lengthen through the left elbow.', 'lengthen the left arm', amount);
  }),
  rule('right-arm-line-collapsed', 'shoulders-arms', 'line', ['rightElbowAngle'], ['right_shoulder', 'right_elbow', 'right_wrist'], (context) => {
    const amount = below(context.measurements.rightElbowAngle!, 110);
    return amount === null ? null : finding('right-arm-line-collapsed', 'shoulders-arms', 'line', ['right_shoulder', 'right_elbow', 'right_wrist'], 'The right elbow line is collapsed.', 'Lengthen through the right elbow.', 'lengthen the right arm', amount);
  }),
  rule('head-extreme-lateral-tilt', 'head', 'line', ['headTiltFromTorso'], ['nose', 'left_shoulder', 'right_shoulder', 'left_hip', 'right_hip'], (context) => {
    const amount = above(context.measurements.headTiltFromTorso!, 25);
    return amount === null ? null : finding('head-extreme-lateral-tilt', 'head', 'line', ['nose', 'left_shoulder', 'right_shoulder', 'left_hip', 'right_hip'], 'The head is tilted far from the torso axis.', 'Bring the head back in line with the torso.', 'bring the head toward the torso axis', amount);
  }),
];

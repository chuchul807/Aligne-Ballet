import { oppositeSide, sideLandmark, type LandmarkName } from '../domain/landmarks';
import type { AnnotationInstruction, BodyRegion, Observation, Priority } from '../domain/types';
import type { Rule, RuleContext } from './types';
import { CONSERVATIVE_RULE_CONFIGURATION } from './commonRules';

const tolerance = CONSERVATIVE_RULE_CONFIGURATION.attitude;

function finding(id: string, region: BodyRegion, priority: Priority, evidence: readonly LandmarkName[], annotation: readonly AnnotationInstruction[], issue: string, action: string, direction: string, severity: number): Observation {
  return { id, ruleId: id, dedupeKey: id, region, priority, confidence: 'low', evidence, annotation, assessability: 'assessable', issue, action, direction, severity };
}

function above(value: number, threshold: number): number | null {
  return Number.isFinite(value) && value > threshold ? (value - threshold) / Math.max(1, Math.abs(threshold)) : null;
}

function below(value: number, threshold: number): number | null {
  return Number.isFinite(value) && value < threshold ? (threshold - value) / Math.max(1, Math.abs(threshold)) : null;
}

function workingLeg(context: RuleContext): readonly [LandmarkName, LandmarkName, LandmarkName] {
  const side = oppositeSide(context.supportingSide);
  return [sideLandmark(side, 'hip'), sideLandmark(side, 'knee'), sideLandmark(side, 'ankle')];
}

const bothLegs = ['left_hip', 'left_knee', 'left_ankle', 'right_hip', 'right_knee', 'right_ankle'] as const;

export const ATTITUDE_RULES: readonly Rule[] = [
  {
    id: 'attitude-working-knee-too-straight', dedupeKey: 'attitude-working-knee-too-straight', positions: ['attitude-derriere'], requiredMeasurements: ['workingKneeAngle'], region: 'working-leg', priority: 'line', evidence: bothLegs,
    evaluate: (context) => {
      const amount = above(context.measurements.workingKneeAngle.value!, tolerance.workingKneeStraightAboveDegrees);
      if (amount === null) return null;
      const evidence = workingLeg(context);
      return finding('attitude-working-knee-too-straight', 'working-leg', 'line', evidence, [{ observationId: 'attitude-working-knee-too-straight', type: 'joint', joints: [evidence[1]] }], 'The working leg reads visually straight rather than bent behind.', 'Soften the working knee into the attitude curve.', 'bend the working knee behind', amount);
    },
  },
  {
    id: 'attitude-working-knee-too-closed', dedupeKey: 'attitude-working-knee-too-closed', positions: ['attitude-derriere'], requiredMeasurements: ['workingKneeAngle'], region: 'working-leg', priority: 'line', evidence: bothLegs,
    evaluate: (context) => {
      const amount = below(context.measurements.workingKneeAngle.value!, tolerance.workingKneeClosedBelowDegrees);
      if (amount === null) return null;
      const evidence = workingLeg(context);
      return finding('attitude-working-knee-too-closed', 'working-leg', 'line', evidence, [{ observationId: 'attitude-working-knee-too-closed', type: 'joint', joints: [evidence[1]] }], 'The working knee is visibly folded very tightly behind.', 'Open the visible bend slightly while keeping the thigh quiet.', 'open the working-knee bend slightly', amount);
    },
  },
  {
    id: 'attitude-level-pelvis', dedupeKey: 'attitude-level-pelvis', positions: ['attitude-derriere'], requiredMeasurements: ['workingAnkleHeightFromHip', 'pelvisSlope'], region: 'pelvis', priority: 'structure', evidence: ['left_hip', 'right_hip', 'left_ankle', 'right_ankle'],
    evaluate: (context) => {
      const raised = above(context.measurements.workingAnkleHeightFromHip.value!, tolerance.pelvisCompensationWorkingAnkleAboveHipRatio);
      const amount = above(Math.abs(context.measurements.pelvisSlope.value!), tolerance.pelvisCompensationSlopeAboveDegrees);
      if (raised === null || amount === null) return null;
      const [, , ankle] = workingLeg(context);
      const evidence = ['left_hip', 'right_hip', ankle] as const;
      return finding('attitude-level-pelvis', 'pelvis', 'structure', evidence, [{ observationId: 'attitude-level-pelvis', type: 'region', joints: evidence }], 'The raised working leg is accompanied by a visible pelvic tilt.', 'Re-level the pelvis before asking for more thigh height.', 'level the pelvis', Math.max(raised, amount));
    },
  },
  {
    id: 'attitude-lift-thigh', dedupeKey: 'attitude-lift-thigh', positions: ['attitude-derriere'], requiredMeasurements: ['workingKneeHeightFromHip', 'pelvisSlope'], region: 'working-leg', priority: 'line', evidence: ['left_hip', 'left_knee', 'right_hip', 'right_knee'],
    evaluate: (context) => {
      const amount = below(context.measurements.workingKneeHeightFromHip.value!, tolerance.workingThighLowBelowHipRatio);
      if (amount === null || Math.abs(context.measurements.pelvisSlope.value!) > tolerance.maxPelvisSlopeForThighHeightDegrees) return null;
      const [hip, knee] = workingLeg(context);
      const evidence = [hip, knee] as const;
      return finding('attitude-lift-thigh', 'working-leg', 'line', evidence, [{ observationId: 'attitude-lift-thigh', type: 'region', joints: evidence }], 'The working knee sits visibly below the hip line.', 'Lift the working thigh slightly while keeping the pelvis level.', 'lift the working thigh slightly', amount);
    },
  },
];

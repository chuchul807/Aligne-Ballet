import { oppositeSide, sideLandmark, type LandmarkName } from '../domain/landmarks';
import type { AnnotationInstruction, BodyRegion, Observation, Priority } from '../domain/types';
import { CONSERVATIVE_RULE_CONFIGURATION } from './commonRules';
import type { Rule, RuleContext } from './types';

const tolerance = CONSERVATIVE_RULE_CONFIGURATION.tenduCroiseDevant;
const frontalKneeTolerance = CONSERVATIVE_RULE_CONFIGURATION.common;
const bothLegs = [
  'left_hip', 'left_knee', 'left_ankle',
  'right_hip', 'right_knee', 'right_ankle',
] as const;
const bothFeet = [
  'left_knee', 'left_ankle', 'left_heel', 'left_foot_index',
  'right_knee', 'right_ankle', 'right_heel', 'right_foot_index',
] as const;

function finding(
  id: string,
  region: BodyRegion,
  priority: Priority,
  evidence: readonly LandmarkName[],
  annotation: readonly AnnotationInstruction[],
  issue: string,
  action: string,
  direction: string,
  severity: number,
): Observation {
  return {
    id, ruleId: id, dedupeKey: id, region, priority, confidence: 'low', evidence, annotation,
    assessability: 'assessable', issue, action, direction, severity,
  };
}

function below(value: number, threshold: number): number | null {
  return Number.isFinite(value) && value < threshold ? (threshold - value) / Math.max(1, threshold) : null;
}

function above(value: number, threshold: number): number | null {
  return Number.isFinite(value) && value > threshold ? (value - threshold) / Math.max(1, threshold) : null;
}

function workingLeg(context: RuleContext): readonly [LandmarkName, LandmarkName, LandmarkName] {
  const side = oppositeSide(context.supportingSide);
  return [sideLandmark(side, 'hip'), sideLandmark(side, 'knee'), sideLandmark(side, 'ankle')];
}

function workingFoot(context: RuleContext): readonly [LandmarkName, LandmarkName, LandmarkName] {
  const side = oppositeSide(context.supportingSide);
  return [
    sideLandmark(side, 'knee'),
    sideLandmark(side, 'ankle'),
    sideLandmark(side, 'foot_index'),
  ];
}

export const TENDU_CROISE_RULES: readonly Rule[] = [
  {
    id: 'tendu-working-knee-bent',
    dedupeKey: 'tendu-working-knee-bent',
    positions: ['tendu-croise-devant'],
    supportedViews: ['front'],
    requiredMeasurements: ['workingKneeAngle', 'workingKneeForwardDepthCue'],
    region: 'working-leg',
    priority: 'line',
    evidence: bothLegs,
    evaluate: (context) => {
      const angleAmount = below(
        context.measurements.workingKneeAngle.value!,
        frontalKneeTolerance.frontalKneeClearlyBentBelowDegrees,
      );
      const depthAmount = above(
        context.measurements.workingKneeForwardDepthCue.value!,
        frontalKneeTolerance.frontalKneeForwardDepthAboveBodyWidthRatio,
      );
      if (angleAmount === null || depthAmount === null) return null;
      const amount = Math.min(angleAmount, depthAmount);
      const evidence = workingLeg(context);
      return finding(
        'tendu-working-knee-bent', 'working-leg', 'line', evidence,
        [{ observationId: 'tendu-working-knee-bent', type: 'joint', joints: [evidence[1]] }],
        'The working knee is visibly bent.',
        'Lengthen and straighten the working leg.',
        'lengthen and straighten the working leg',
        amount,
      );
    },
  },
  {
    id: 'tendu-foot-not-pointed',
    dedupeKey: 'tendu-foot-not-pointed',
    positions: ['tendu-croise-devant'],
    supportedViews: ['front'],
    requiredMeasurements: ['workingFootPointAngle'],
    region: 'feet',
    priority: 'line',
    evidence: bothFeet,
    evaluate: (context) => {
      const amount = below(context.measurements.workingFootPointAngle.value!, tolerance.workingFootPointBelowDegrees);
      if (amount === null) return null;
      const evidence = workingFoot(context);
      return finding(
        'tendu-foot-not-pointed', 'feet', 'line', evidence,
        [{ observationId: 'tendu-foot-not-pointed', type: 'region', joints: evidence }],
        'The working foot does not continue the visible tendu line.',
        'Lengthen through the ankle and point the working toes.',
        'lengthen and point the working foot',
        amount,
      );
    },
  },
  {
    id: 'tendu-working-foot-lifted',
    dedupeKey: 'tendu-working-foot-lifted',
    positions: ['tendu-croise-devant'],
    supportedViews: ['front'],
    requiredMeasurements: ['workingFootHeightFromSupportingFoot'],
    region: 'feet',
    priority: 'line',
    evidence: ['left_foot_index', 'right_foot_index'],
    evaluate: (context) => {
      const amount = above(context.measurements.workingFootHeightFromSupportingFoot.value!, tolerance.workingFootHeightAboveTorsoRatio);
      if (amount === null) return null;
      const workingSide = oppositeSide(context.supportingSide);
      const evidence = [
        sideLandmark(context.supportingSide, 'foot_index'),
        sideLandmark(workingSide, 'foot_index'),
      ] as const;
      return finding(
        'tendu-working-foot-lifted', 'feet', 'line', evidence,
        [{ observationId: 'tendu-working-foot-lifted', type: 'region', joints: evidence }],
        'The working toes sit visibly above the supporting-foot level.',
        'Reach the working toes back to the floor.',
        'lower the working toes to the floor',
        amount,
      );
    },
  },
  {
    id: 'tendu-crossing-too-small',
    dedupeKey: 'tendu-crossing-too-small',
    positions: ['tendu-croise-devant'],
    supportedViews: ['front'],
    requiredMeasurements: ['croiseCrossingSeparation'],
    region: 'working-leg',
    priority: 'line',
    evidence: ['left_hip', 'right_hip', 'left_ankle', 'right_ankle'],
    evaluate: (context) => {
      const amount = below(context.measurements.croiseCrossingSeparation.value!, tolerance.crossingSeparationBelowTorsoRatio);
      if (amount === null) return null;
      const workingSide = oppositeSide(context.supportingSide);
      const evidence = [
        sideLandmark(context.supportingSide, 'ankle'),
        sideLandmark(workingSide, 'ankle'),
      ] as const;
      return finding(
        'tendu-crossing-too-small', 'working-leg', 'line', evidence,
        [{ observationId: 'tendu-crossing-too-small', type: 'region', joints: evidence }],
        'The working leg does not cross far enough beyond the supporting-leg line.',
        'Reach the working foot slightly farther across while keeping both knees straight.',
        'increase the visible croise crossing',
        amount,
      );
    },
  },
];

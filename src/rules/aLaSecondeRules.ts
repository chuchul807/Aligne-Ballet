import { oppositeSide, sideLandmark, type LandmarkName } from '../domain/landmarks';
import type { AnnotationInstruction, BodyRegion, Observation, Priority } from '../domain/types';
import { CONSERVATIVE_RULE_CONFIGURATION } from './commonRules';
import type { Rule, RuleContext } from './types';

const tolerance = CONSERVATIVE_RULE_CONFIGURATION.aLaSeconde;
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
  dedupeKey = id,
): Observation {
  return {
    id, ruleId: id, dedupeKey, region, priority, confidence: 'low', evidence, annotation,
    assessability: 'assessable', issue, action, direction, severity,
  };
}

function below(value: number, threshold: number): number | null {
  return Number.isFinite(value) && value < threshold ? (threshold - value) / Math.max(1, threshold) : null;
}

function above(value: number, threshold: number): number | null {
  return Number.isFinite(value) && value > threshold ? (value - threshold) / Math.max(1, threshold) : null;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function workingLeg(context: RuleContext): readonly [LandmarkName, LandmarkName, LandmarkName] {
  const side = oppositeSide(context.supportingSide);
  return [sideLandmark(side, 'hip'), sideLandmark(side, 'knee'), sideLandmark(side, 'ankle')];
}

function workingFoot(context: RuleContext): readonly [LandmarkName, LandmarkName, LandmarkName, LandmarkName] {
  const side = oppositeSide(context.supportingSide);
  return [
    sideLandmark(side, 'knee'),
    sideLandmark(side, 'ankle'),
    sideLandmark(side, 'heel'),
    sideLandmark(side, 'foot_index'),
  ];
}

export const A_LA_SECONDE_RULES: readonly Rule[] = [
  {
    id: 'a-la-seconde-working-knee-bent',
    dedupeKey: 'a-la-seconde-working-knee-bent',
    positions: ['a-la-seconde'],
    supportedViews: ['front'],
    requiredMeasurements: ['workingKneeAngle', 'workingKneeForwardDepthCue'],
    region: 'working-leg',
    priority: 'stability',
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
        'a-la-seconde-working-knee-bent', 'working-leg', 'stability', evidence,
        [{ observationId: 'a-la-seconde-working-knee-bent', type: 'joint', joints: [evidence[1]] }],
        'The working knee is visibly bent.',
        'Lengthen and straighten the working leg.',
        'lengthen and straighten the working leg',
        amount,
      );
    },
  },
  {
    id: 'a-la-seconde-working-leg-not-side',
    dedupeKey: 'a-la-seconde-working-leg-not-side',
    positions: ['a-la-seconde'],
    supportedViews: ['front'],
    requiredMeasurements: ['workingAnkleOutwardOffset', 'workingAnkleHeightFromHip'],
    region: 'working-leg',
    priority: 'line',
    evidence: bothLegs,
    evaluate: (context) => {
      const heightAboveHip = Math.max(0, context.measurements.workingAnkleHeightFromHip.value!);
      const extraHeight = Math.max(0, heightAboveHip - tolerance.verticalAllowanceStartsAboveHipRatio);
      const requiredOutwardOffset = Math.max(
        tolerance.minimumHighLegOutwardOffsetRatio,
        tolerance.workingAnkleOutwardOffsetBelowTorsoRatio
          - extraHeight * tolerance.outwardAllowancePerTorsoHeight,
      );
      const amount = below(context.measurements.workingAnkleOutwardOffset.value!, requiredOutwardOffset);
      if (amount === null) return null;
      const evidence = workingLeg(context);
      return finding(
        'a-la-seconde-working-leg-not-side', 'working-leg', 'line', evidence,
        [{ observationId: 'a-la-seconde-working-leg-not-side', type: 'region', joints: evidence }],
        'The working leg is not travelling clearly to the side at this height.',
        'Move the working leg outward into the side plane without forcing it lower.',
        'move the working leg into the side plane',
        amount,
      );
    },
  },
  {
    id: 'a-la-seconde-foot-not-pointed',
    dedupeKey: 'a-la-seconde-foot-not-pointed',
    positions: ['a-la-seconde'],
    supportedViews: ['front'],
    requiredMeasurements: ['workingFootPointAngle'],
    region: 'feet',
    priority: 'structure',
    evidence: bothFeet,
    evaluate: (context) => {
      const amount = below(context.measurements.workingFootPointAngle.value!, tolerance.workingFootPointBelowDegrees);
      if (amount === null) return null;
      const [knee, ankle, , toe] = workingFoot(context);
      const evidence = [knee, ankle, toe] as const;
      return finding(
        'a-la-seconde-foot-not-pointed', 'feet', 'structure', evidence,
        [{ observationId: 'a-la-seconde-foot-not-pointed', type: 'region', joints: evidence }],
        'The working foot does not continue the visible line of the leg.',
        'Lengthen through the ankle and point the working toes.',
        'lengthen and point the working foot',
        amount,
      );
    },
  },
  {
    id: 'a-la-seconde-turnout-not-visible',
    dedupeKey: 'a-la-seconde-turnout-not-visible',
    positions: ['a-la-seconde'],
    supportedViews: ['front'],
    requiredMeasurements: ['workingHeelVisibilityCue'],
    region: 'feet',
    priority: 'structure',
    evidence: bothFeet,
    evaluate: (context) => {
      const amount = below(context.measurements.workingHeelVisibilityCue.value!, tolerance.workingHeelVisibilityBelowBodyWidthRatio);
      if (amount === null) return null;
      const [, , heel, toe] = workingFoot(context);
      const evidence = [heel, toe] as const;
      return finding(
        'a-la-seconde-turnout-not-visible', 'feet', 'structure', evidence,
        [{ observationId: 'a-la-seconde-turnout-not-visible', type: 'region', joints: evidence }],
        'The working heel does not appear forward enough to confirm the turned-out foot line.',
        'Rotate the working leg outward until the heel is slightly visible.',
        'show a clearer turned-out heel line',
        amount,
      );
    },
  },
  {
    id: 'a-la-seconde-pelvis-out-of-line',
    dedupeKey: 'pelvis-level',
    positions: ['a-la-seconde'],
    supportedViews: ['front'],
    requiredMeasurements: ['pelvisSlope', 'workingAnkleHeightFromHip', 'workingAnkleOutwardOffset'],
    region: 'pelvis',
    priority: 'line',
    evidence: ['left_hip', 'right_hip', 'left_ankle', 'right_ankle'],
    evaluate: (context) => {
      const height = context.measurements.workingAnkleHeightFromHip.value!;
      const outward = Math.max(0.01, Math.abs(context.measurements.workingAnkleOutwardOffset.value!));
      const heightToOutward = height / outward;
      const approachingHorizontal = clamp01(1 + heightToOutward);
      const aboveHorizontal = clamp01(heightToOutward);
      const allowedSlope = tolerance.basePelvisSlopeDegrees
        + (tolerance.nearHorizontalPelvisSlopeDegrees - tolerance.basePelvisSlopeDegrees) * approachingHorizontal
        + (tolerance.maximumPelvisSlopeDegrees - tolerance.nearHorizontalPelvisSlopeDegrees) * aboveHorizontal;
      const amount = above(Math.abs(context.measurements.pelvisSlope.value!), allowedSlope);
      if (amount === null) return null;
      const [, , workingAnkle] = workingLeg(context);
      const evidence = ['left_hip', 'right_hip', workingAnkle] as const;
      return finding(
        'a-la-seconde-pelvis-out-of-line', 'pelvis', 'line', evidence,
        [{ observationId: 'a-la-seconde-pelvis-out-of-line', type: 'region', joints: evidence }],
        'The visible pelvic line is displaced more than the leg height requires.',
        'Bring the pelvis closer to level without lowering the working leg unnecessarily.',
        'restore the visible pelvic line',
        amount,
        'pelvis-level',
      );
    },
  },
];

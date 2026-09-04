import { oppositeSide, sideLandmark, type LandmarkName } from '../domain/landmarks';
import type { AnnotationInstruction, BodyRegion, Observation, Priority } from '../domain/types';
import type { Rule, RuleContext } from './types';

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
    id,
    ruleId: id,
    region,
    priority,
    confidence: 'low',
    evidence,
    annotation,
    assessability: 'assessable',
    issue,
    action,
    direction,
    severity,
  };
}

function below(value: number, threshold: number): number | null {
  return Number.isFinite(value) && value < threshold ? (threshold - value) / Math.abs(threshold) : null;
}

function above(value: number, threshold: number): number | null {
  return Number.isFinite(value) && value > threshold ? (value - threshold) / Math.max(1 - threshold, threshold) : null;
}

function absolute(value: number): number {
  return Math.abs(value);
}

function workingLeg(context: RuleContext): readonly [LandmarkName, LandmarkName, LandmarkName] {
  const workingSide = oppositeSide(context.supportingSide);
  return [
    sideLandmark(workingSide, 'hip'),
    sideLandmark(workingSide, 'knee'),
    sideLandmark(workingSide, 'ankle'),
  ];
}

export const ARABESQUE_RULES: readonly Rule[] = [
  {
    id: 'arabesque-working-knee-bent',
    positions: ['arabesque'],
    requiredMeasurements: ['workingKneeAngle'],
    region: 'working-leg',
    priority: 'line',
    evidence: ['left_hip', 'left_knee', 'left_ankle', 'right_hip', 'right_knee', 'right_ankle'],
    evaluate: (context) => {
      const amount = below(context.measurements.workingKneeAngle!, 165);
      if (amount === null) return null;
      const evidence = workingLeg(context);
      const [, knee] = evidence;
      return finding(
        'arabesque-working-knee-bent', 'working-leg', 'line', evidence,
        [{ observationId: 'arabesque-working-knee-bent', type: 'joint', joints: [knee] }],
        'The working knee is visibly bent.', 'Lengthen and straighten the working leg.',
        'lengthen and straighten the working leg', amount,
      );
    },
  },
  {
    id: 'arabesque-lower-leg-for-pelvis',
    positions: ['arabesque'],
    requiredMeasurements: ['workingAnkleHeightFromHip', 'pelvisSlope'],
    region: 'pelvis',
    priority: 'structure',
    evidence: ['left_hip', 'right_hip', 'left_ankle', 'right_ankle'],
    evaluate: (context) => {
      const heightAmount = above(context.measurements.workingAnkleHeightFromHip!, 0);
      const pelvisAmount = above(absolute(context.measurements.pelvisSlope!), 10);
      if (heightAmount === null || pelvisAmount === null) return null;
      const [, , ankle] = workingLeg(context);
      const evidence = ['left_hip', 'right_hip', ankle] as const;
      return finding(
        'arabesque-lower-leg-for-pelvis', 'pelvis', 'structure', evidence,
        [{ observationId: 'arabesque-lower-leg-for-pelvis', type: 'region', joints: evidence }],
        'The raised working leg is accompanied by visible pelvic compensation.',
        'Lower the working leg slightly and re-level the pelvis.',
        'lower the working leg slightly and re-level the pelvis', Math.max(heightAmount, pelvisAmount),
      );
    },
  },
  {
    id: 'arabesque-working-leg-too-low',
    positions: ['arabesque'],
    requiredMeasurements: ['workingAnkleHeightFromHip', 'pelvisSlope'],
    region: 'working-leg',
    priority: 'line',
    evidence: ['left_hip', 'left_knee', 'left_ankle', 'right_hip', 'right_knee', 'right_ankle'],
    evaluate: (context) => {
      const amount = below(context.measurements.workingAnkleHeightFromHip!, -0.30);
      if (amount === null || absolute(context.measurements.pelvisSlope!) > 8) return null;
      const evidence = workingLeg(context);
      return finding(
        'arabesque-working-leg-too-low', 'working-leg', 'line', evidence,
        [{ observationId: 'arabesque-working-leg-too-low', type: 'region', joints: evidence }],
        'The working leg is visibly low relative to the hip.',
        'Lengthen the working leg back and slightly upward without changing the pelvis.',
        'lengthen the working leg back and slightly upward without changing the pelvis', amount,
      );
    },
  },
  {
    id: 'arabesque-torso-collapse',
    positions: ['arabesque'],
    requiredMeasurements: ['torsoLateralOffset'],
    region: 'torso',
    priority: 'structure',
    evidence: ['left_shoulder', 'right_shoulder', 'left_hip', 'right_hip'],
    evaluate: (context) => {
      const amount = below(context.measurements.torsoLateralOffset!, -0.18);
      if (amount === null) return null;
      const evidence = ['left_shoulder', 'right_shoulder', 'left_hip', 'right_hip'] as const;
      return finding(
        'arabesque-torso-collapse', 'torso', 'structure', evidence,
        [{ observationId: 'arabesque-torso-collapse', type: 'region', joints: evidence }],
        'The torso is collapsing away from the working leg.', 'Lengthen the torso forward and upward.',
        'lengthen the torso forward and upward', amount,
      );
    },
  },
];

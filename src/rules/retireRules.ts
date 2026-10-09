import { oppositeSide, sideLandmark, type LandmarkName } from '../domain/landmarks';
import type { AnnotationInstruction, BodyRegion, Observation, Priority } from '../domain/types';
import type { Rule, RuleContext } from './types';
import { CONSERVATIVE_RULE_CONFIGURATION } from './commonRules';

const tolerance = CONSERVATIVE_RULE_CONFIGURATION.retire;

function finding(id: string, region: BodyRegion, priority: Priority, evidence: readonly LandmarkName[], annotation: readonly AnnotationInstruction[], issue: string, action: string, direction: string, severity: number): Observation {
  return { id, ruleId: id, dedupeKey: id, region, priority, confidence: 'low', evidence, annotation, assessability: 'assessable', issue, action, direction, severity };
}
function above(value: number, threshold: number): number | null { return Number.isFinite(value) && value > threshold ? (value - threshold) / Math.max(1, threshold) : null; }
function below(value: number, threshold: number): number | null { return Number.isFinite(value) && value < threshold ? (threshold - value) / Math.max(1, threshold) : null; }
function workingLeg(context: RuleContext): readonly [LandmarkName, LandmarkName, LandmarkName] { const side = oppositeSide(context.supportingSide); return [sideLandmark(side, 'hip'), sideLandmark(side, 'knee'), sideLandmark(side, 'ankle')]; }
function supportHipAndWorkingKnee(context: RuleContext): readonly [LandmarkName, LandmarkName] { return [sideLandmark(context.supportingSide, 'hip'), sideLandmark(oppositeSide(context.supportingSide), 'knee')]; }
function supportLeg(context: RuleContext): readonly [LandmarkName, LandmarkName, LandmarkName] { const side = context.supportingSide; return [sideLandmark(side, 'hip'), sideLandmark(side, 'knee'), sideLandmark(side, 'ankle')]; }
const bothLegs = ['left_hip', 'left_knee', 'left_ankle', 'right_hip', 'right_knee', 'right_ankle'] as const;

export const RETIRE_RULES: readonly Rule[] = [
  { id: 'retire-place-foot-at-knee', dedupeKey: 'retire-place-foot-at-knee', positions: ['retire-passe'], requiredMeasurements: ['workingAnkleToSupportingKnee'], region: 'feet', priority: 'line', evidence: bothLegs, evaluate: (context) => { const amount = above(context.measurements.workingAnkleToSupportingKnee.value!, tolerance.workingFootDistanceAboveTorsoRatio); if (amount === null) return null; const [, supportKnee] = supportLeg(context); const [, , workingAnkle] = workingLeg(context); const evidence = [supportKnee, workingAnkle] as const; return finding('retire-place-foot-at-knee', 'feet', 'line', evidence, [{ observationId: 'retire-place-foot-at-knee', type: 'region', joints: evidence }], 'The working foot is visibly away from the supporting knee.', 'Place the working foot closer to the supporting knee.', 'move the working foot toward the supporting knee', amount); } },
  { id: 'retire-open-working-knee', dedupeKey: 'retire-open-working-knee', positions: ['retire-passe'], supportedViews: ['front'], requiredMeasurements: ['workingKneeLateralOffset'], region: 'working-leg', priority: 'line', evidence: ['left_hip', 'left_knee', 'right_hip', 'right_knee'], evaluate: (context) => { const amount = below(context.measurements.workingKneeLateralOffset.value!, tolerance.workingKneeLateralOffsetBelowTorsoRatio); const evidence = supportHipAndWorkingKnee(context); if (amount === null) return null; return finding('retire-open-working-knee', 'working-leg', 'line', evidence, [{ observationId: 'retire-open-working-knee', type: 'region', joints: evidence }], 'From the front, the working knee appears close to the standing side.', 'Move the visible working knee outward slightly.', 'move the working knee outward', amount); } },
];

import { describe, expect, it } from 'vitest';
import { landmarkPerson } from '../../tests/builders/landmarks';
import { measuredPose, type MeasurementValueOverrides } from '../../tests/builders/measurements';
import { evaluateRules } from './evaluateRules';
import { RETIRE_RULES } from './retireRules';
import type { RuleContext } from './types';
import acceptable from '../../tests/fixtures/retire-acceptable.json';
import commonErrors from '../../tests/fixtures/retire-common-errors.json';
import { landmarkNames } from '../domain/landmarks';
import type { Landmark } from '../domain/types';
import { retireFrontStraightSupport } from '../../tests/fixtures/retire-front-straight-support';
import { evaluateLandmarkReliability } from '../reliability/evaluateLandmarkReliability';
import { measurePose } from '../analysis/measurePose';
import { COMMON_RULES } from './commonRules';
import { deduplicateObservations } from './deduplicateObservations';
import { FEEDBACK_COPY } from '../feedback/copy';

interface Fixture { position: 'retire-passe'; supportingSide: 'left' | 'right'; expectedRuleIds: readonly string[]; landmarks: readonly Landmark[]; }
const fixture = (value: unknown) => value as Fixture;

function context(overrides: MeasurementValueOverrides = {}, view: 'front' | 'three-quarter-side' | undefined = 'front'): RuleContext {
  const landmarks = landmarkPerson();
  const measurementView = view ?? 'front';
  const { reliability, measurements } = measuredPose(landmarks, 'left', measurementView, overrides);
  return {
    position: 'retire-passe', supportingSide: 'left', landmarks, view, reliability, measurements,
  };
}

describe('Retiré / Passé rules', () => {
  it.each([acceptable, commonErrors, retireFrontStraightSupport])('keeps all 33 named landmarks in every fixture', (value) => {
    expect(value.landmarks).toHaveLength(33);
    expect(value.landmarks.map((landmark) => landmark.name).sort()).toEqual([...landmarkNames].sort());
  });

  it('does not call the reported straight supporting leg bent or make unsupported stacking claims', () => {
    const fixture = retireFrontStraightSupport;
    const reliability = evaluateLandmarkReliability(fixture.landmarks, fixture.view);
    const measurements = measurePose(fixture.landmarks, fixture.supportingSide, reliability, fixture.view, 1, 1);
    const ids = deduplicateObservations(evaluateRules(
      [...COMMON_RULES, ...RETIRE_RULES],
      { ...fixture, measurements, reliability },
    )).filter((item) => item.assessability === 'assessable').map((item) => item.ruleId);

    for (const ruleId of fixture.expectedPresentRuleIds) expect(ids).toContain(ruleId);
    for (const ruleId of fixture.expectedAbsentRuleIds) expect(ids).not.toContain(ruleId);
    expect([
      FEEDBACK_COPY['pelvis-unlevel'].high,
      FEEDBACK_COPY['pelvis-unlevel'].medium,
      FEEDBACK_COPY['supporting-lateral-offset'].high,
      FEEDBACK_COPY['supporting-lateral-offset'].medium,
    ].join(' '))
      .not.toMatch(/directly over|centre of mass|forward|backward/i);
  });

  it('matches the declared acceptable and common-error fixture findings with confirmed frontal view', () => {
    for (const value of [acceptable, commonErrors]) {
      const input = fixture(value);
      const { reliability, measurements } = measuredPose(input.landmarks, input.supportingSide, 'front');
      expect(evaluateRules(RETIRE_RULES, { position: input.position, supportingSide: input.supportingSide, view: 'front', landmarks: input.landmarks, reliability, measurements }).filter((item) => item.assessability === 'assessable').map((item) => item.ruleId)).toEqual(input.expectedRuleIds);
    }
  });

  it('keeps common-error rule IDs after left-right mirroring', () => {
    const mirrored = { ...commonErrors, supportingSide: 'right' as const, landmarks: commonErrors.landmarks.map((landmark) => ({ ...landmark, x: 1 - landmark.x, name: landmark.name.replace(/^left|^right/, (side) => side === 'left' ? 'right' : 'left') as Landmark['name'] })) };
    const ids = (value: unknown) => { const input = fixture(value); const { reliability, measurements } = measuredPose(input.landmarks, input.supportingSide, 'front'); return evaluateRules(RETIRE_RULES, { position: input.position, supportingSide: input.supportingSide, view: 'front', landmarks: input.landmarks, reliability, measurements }).filter((item) => item.assessability === 'assessable').map((item) => item.ruleId).sort(); };
    expect(ids(mirrored)).toEqual(ids(commonErrors));
  });
  it('detects a working foot that is far from the supporting knee', () => {
    const ids = evaluateRules(RETIRE_RULES, context({ workingAnkleToSupportingKnee: 0.33 })).map((item) => item.ruleId);
    expect(ids).toContain('retire-place-foot-at-knee');
  });

  it('does not infer hip turnout from a frontal image', () => {
    expect(RETIRE_RULES.some((rule) => rule.id.includes('turnout'))).toBe(false);
  });

  it('suppresses the visible knee-placement finding without a confirmed frontal view', () => {
    const measures = { workingKneeLateralOffset: 0.27 };
    const notConfirmed: RuleContext = { ...context(measures), view: undefined };
    expect(evaluateRules(RETIRE_RULES, notConfirmed).find((item) => item.ruleId === 'retire-open-working-knee')).toMatchObject({ assessability: 'unassessable' });
    expect(evaluateRules(RETIRE_RULES, context(measures, 'three-quarter-side')).find((item) => item.ruleId === 'retire-open-working-knee')).toMatchObject({ assessability: 'unassessable' });
    expect(evaluateRules(RETIRE_RULES, context(measures, 'front')).find((item) => item.ruleId === 'retire-open-working-knee')).toMatchObject({ assessability: 'assessable' });
  });

  it('keeps knee-placement assessable when the unused working ankle has low visibility', () => {
    const base = context({ workingKneeLateralOffset: 0.27 }, 'front');
    const landmarks = base.landmarks.map((landmark) => landmark.name === 'right_ankle' ? { ...landmark, visibility: 0.2 } : landmark);
    const { reliability, measurements } = measuredPose(landmarks, 'left', 'front', { workingKneeLateralOffset: 0.27 });
    const finding = evaluateRules(RETIRE_RULES, { ...base, landmarks, reliability, measurements }).find((item) => item.ruleId === 'retire-open-working-knee');
    expect(finding).toMatchObject({ assessability: 'assessable', confidence: 'high', evidence: ['left_hip', 'right_knee'] });
  });

  it.each([
    ['supporting hip', 'left_hip', 0.59, false],
    ['working knee', 'right_knee', 0.59, false],
    ['supporting hip medium-confidence boundary', 'left_hip', 0.60, false],
    ['working knee medium-confidence boundary', 'right_knee', 0.60, false],
    ['supporting hip high-confidence boundary', 'left_hip', 0.80, true],
    ['working knee high-confidence boundary', 'right_knee', 0.80, true],
    ['unused working ankle', 'right_ankle', 0.2, true],
  ] as const)('requires high-confidence %s evidence for the frontal knee-placement correction', (_label, landmarkName, visibility, expected) => {
    const base = context({ workingKneeLateralOffset: 0.27 }, 'front');
    const landmarks = base.landmarks.map((landmark) => landmark.name === landmarkName ? { ...landmark, visibility } : landmark);
    const { reliability, measurements } = measuredPose(landmarks, 'left', 'front', { workingKneeLateralOffset: 0.27 });
    const finding = evaluateRules(RETIRE_RULES, { ...base, landmarks, reliability, measurements }).find((item) => item.ruleId === 'retire-open-working-knee');
    expect(finding?.confidence === 'high').toBe(expected);
  });

  it.each(['left', 'right'] as const)('uses bilateral measurement fallback evidence when the working knee is absent for %s support', (supportingSide) => {
    const base = context({}, 'front');
    const landmarks = (supportingSide === 'left' ? base.landmarks : base.landmarks.map((landmark) => ({ ...landmark, x: 1 - landmark.x, name: landmark.name.replace(/^left|^right/, (side) => side === 'left' ? 'right' : 'left') as Landmark['name'] }))).filter((landmark) => landmark.name !== (supportingSide === 'left' ? 'right_knee' : 'left_knee'));
    const { reliability, measurements } = measuredPose(landmarks, supportingSide, 'front');
    const finding = evaluateRules(RETIRE_RULES, { ...base, supportingSide, view: 'front', landmarks, reliability, measurements }).find((item) => item.ruleId === 'retire-open-working-knee');
    expect(finding).toMatchObject({ assessability: 'unassessable', evidence: ['left_hip', 'left_knee', 'right_hip', 'right_knee'] });
  });

  it.each([
    ['retire-place-foot-at-knee', { workingAnkleToSupportingKnee: 0.32 }, { workingAnkleToSupportingKnee: 0.33 }],
    ['retire-open-working-knee', { workingKneeLateralOffset: 0.28 }, { workingKneeLateralOffset: 0.27 }],
  ] as const)('applies %s only beyond its threshold', (ruleId, boundary, triggered) => {
    expect(evaluateRules(RETIRE_RULES, context(boundary)).map((item) => item.ruleId)).not.toContain(ruleId);
    expect(evaluateRules(RETIRE_RULES, context(triggered)).map((item) => item.ruleId)).toContain(ruleId);
  });
});

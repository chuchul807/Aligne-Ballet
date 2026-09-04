import { describe, expect, it } from 'vitest';
import { measurePose, type MeasurementSet } from '../analysis/measurePose';
import { landmarkPerson } from '../../tests/builders/landmarks';
import { evaluateRules } from './evaluateRules';
import { RETIRE_RULES } from './retireRules';
import type { RuleContext } from './types';
import acceptable from '../../tests/fixtures/retire-acceptable.json';
import commonErrors from '../../tests/fixtures/retire-common-errors.json';
import { landmarkNames } from '../domain/landmarks';
import type { Landmark } from '../domain/types';

interface Fixture { position: 'retire-passe'; supportingSide: 'left' | 'right'; expectedRuleIds: readonly string[]; landmarks: readonly Landmark[]; }
const fixture = (value: unknown) => value as Fixture;

function context(overrides: Partial<MeasurementSet> = {}, view: 'front' | 'three-quarter-side' | undefined = 'front'): RuleContext {
  const landmarks = landmarkPerson();
  return {
    position: 'retire-passe', supportingSide: 'left', landmarks, view,
    measurements: { ...measurePose(landmarks, 'left'), ...overrides },
  };
}

describe('Retiré / Passé rules', () => {
  it.each([acceptable, commonErrors])('keeps all 33 named landmarks in every fixture', (value) => {
    expect(value.landmarks).toHaveLength(33);
    expect(value.landmarks.map((landmark) => landmark.name).sort()).toEqual([...landmarkNames].sort());
  });

  it('matches the declared acceptable and common-error fixture findings with confirmed frontal view', () => {
    for (const value of [acceptable, commonErrors]) {
      const input = fixture(value);
      expect(evaluateRules(RETIRE_RULES, { position: input.position, supportingSide: input.supportingSide, view: 'front', landmarks: input.landmarks, measurements: measurePose(input.landmarks, input.supportingSide) }).map((item) => item.ruleId)).toEqual(input.expectedRuleIds);
    }
  });

  it('keeps common-error rule IDs after left-right mirroring', () => {
    const mirrored = { ...commonErrors, supportingSide: 'right' as const, landmarks: commonErrors.landmarks.map((landmark) => ({ ...landmark, x: 1 - landmark.x, name: landmark.name.replace(/^left|^right/, (side) => side === 'left' ? 'right' : 'left') as Landmark['name'] })) };
    const ids = (value: unknown) => { const input = fixture(value); return evaluateRules(RETIRE_RULES, { position: input.position, supportingSide: input.supportingSide, view: 'front', landmarks: input.landmarks, measurements: measurePose(input.landmarks, input.supportingSide) }).map((item) => item.ruleId).sort(); };
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
    expect(evaluateRules(RETIRE_RULES, notConfirmed).map((item) => item.ruleId)).not.toContain('retire-open-working-knee');
    expect(evaluateRules(RETIRE_RULES, context(measures, 'three-quarter-side')).map((item) => item.ruleId)).not.toContain('retire-open-working-knee');
    expect(evaluateRules(RETIRE_RULES, context(measures, 'front')).map((item) => item.ruleId)).toContain('retire-open-working-knee');
  });

  it.each([
    ['retire-place-foot-at-knee', { workingAnkleToSupportingKnee: 0.32 }, { workingAnkleToSupportingKnee: 0.33 }],
    ['retire-open-working-knee', { workingKneeLateralOffset: 0.28 }, { workingKneeLateralOffset: 0.27 }],
    ['retire-keep-pelvis-level', { pelvisSlope: 8 }, { pelvisSlope: -8.01 }],
    ['retire-stack-over-support', { supportingAnkleUnderHipOffset: 0.18 }, { supportingAnkleUnderHipOffset: 0.19 }],
  ] as const)('applies %s only beyond its threshold', (ruleId, boundary, triggered) => {
    expect(evaluateRules(RETIRE_RULES, context(boundary)).map((item) => item.ruleId)).not.toContain(ruleId);
    expect(evaluateRules(RETIRE_RULES, context(triggered)).map((item) => item.ruleId)).toContain(ruleId);
  });
});

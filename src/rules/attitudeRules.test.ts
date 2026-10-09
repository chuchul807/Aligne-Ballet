import { describe, expect, it } from 'vitest';
import { landmarkPerson } from '../../tests/builders/landmarks';
import { measuredPose, type MeasurementValueOverrides } from '../../tests/builders/measurements';
import { evaluateRules } from './evaluateRules';
import { ATTITUDE_RULES } from './attitudeRules';
import type { RuleContext } from './types';
import acceptable from '../../tests/fixtures/attitude-acceptable.json';
import commonErrors from '../../tests/fixtures/attitude-common-errors.json';
import { landmarkNames } from '../domain/landmarks';
import type { Landmark } from '../domain/types';

interface Fixture { position: 'attitude-derriere'; supportingSide: 'left' | 'right'; expectedRuleIds: readonly string[]; landmarks: readonly Landmark[]; }
const fixture = (value: unknown) => value as Fixture;

function context(overrides: MeasurementValueOverrides = {}): RuleContext {
  const landmarks = landmarkPerson();
  const view = 'three-quarter-side';
  const { reliability, measurements } = measuredPose(landmarks, 'left', view, overrides);
  return {
    position: 'attitude-derriere', supportingSide: 'left', view, landmarks, reliability, measurements,
  };
}

describe('Attitude derrière rules', () => {
  it.each([acceptable, commonErrors])('keeps all 33 named landmarks in every fixture', (value) => {
    expect(value.landmarks).toHaveLength(33);
    expect(value.landmarks.map((landmark) => landmark.name).sort()).toEqual([...landmarkNames].sort());
  });

  it('matches the declared acceptable and common-error fixture findings', () => {
    for (const value of [acceptable, commonErrors]) {
      const input = fixture(value);
      const view = 'three-quarter-side';
      const { reliability, measurements } = measuredPose(input.landmarks, input.supportingSide, view);
      expect(evaluateRules(ATTITUDE_RULES, { position: input.position, supportingSide: input.supportingSide, view, landmarks: input.landmarks, reliability, measurements }).filter((item) => item.assessability === 'assessable').map((item) => item.ruleId)).toEqual(input.expectedRuleIds);
    }
  });

  it('keeps common-error rule IDs after left-right mirroring', () => {
    const mirrored = { ...commonErrors, supportingSide: 'right' as const, landmarks: commonErrors.landmarks.map((landmark) => ({ ...landmark, x: 1 - landmark.x, name: landmark.name.replace(/^left|^right/, (side) => side === 'left' ? 'right' : 'left') as Landmark['name'] })) };
    const ids = (value: unknown) => { const input = fixture(value); const view = 'three-quarter-side'; const { reliability, measurements } = measuredPose(input.landmarks, input.supportingSide, view); return evaluateRules(ATTITUDE_RULES, { position: input.position, supportingSide: input.supportingSide, view, landmarks: input.landmarks, reliability, measurements }).filter((item) => item.assessability === 'assessable').map((item) => item.ruleId).sort(); };
    expect(ids(mirrored)).toEqual(ids(commonErrors));
  });
  it.each(['left', 'right'] as const)('keeps missing working-knee fallback evidence bilateral for %s support', (supportingSide) => {
    const base = context();
    const source = supportingSide === 'left' ? base.landmarks : base.landmarks.map((landmark) => ({ ...landmark, x: 1 - landmark.x, name: landmark.name.replace(/^left|^right/, (side) => side === 'left' ? 'right' : 'left') as Landmark['name'] }));
    const landmarks = source.filter((landmark) => landmark.name !== (supportingSide === 'left' ? 'right_knee' : 'left_knee'));
    const view = 'three-quarter-side';
    const { reliability, measurements } = measuredPose(landmarks, supportingSide, view);
    const findings = evaluateRules(ATTITUDE_RULES, { ...base, supportingSide, view, landmarks, reliability, measurements });
    expect(findings.find((item) => item.ruleId === 'attitude-lift-thigh')).toMatchObject({ assessability: 'unassessable', evidence: ['left_hip', 'left_knee', 'right_hip', 'right_knee'] });
  });
  it('distinguishes a straight working knee from an attitude shape', () => {
    const ids = evaluateRules(ATTITUDE_RULES, context({ workingKneeAngle: 146 })).map((item) => item.ruleId);
    expect(ids).toContain('attitude-working-knee-too-straight');
  });

  it('prioritises pelvic control before raising the thigh', () => {
    const ids = evaluateRules(ATTITUDE_RULES, context({ workingAnkleHeightFromHip: 0.01, workingKneeHeightFromHip: -0.3, pelvisSlope: 11 })).map((item) => item.ruleId);
    expect(ids).toContain('attitude-level-pelvis');
    expect(ids).not.toContain('attitude-lift-thigh');
  });

  it.each([
    ['attitude-working-knee-too-straight', { workingKneeAngle: 145 }, { workingKneeAngle: 146 }],
    ['attitude-working-knee-too-closed', { workingKneeAngle: 65 }, { workingKneeAngle: 64 }],
    ['attitude-level-pelvis', { workingAnkleHeightFromHip: 0, pelvisSlope: 11 }, { workingAnkleHeightFromHip: 0.01, pelvisSlope: 11 }],
    ['attitude-lift-thigh', { workingKneeHeightFromHip: -0.25, pelvisSlope: 8 }, { workingKneeHeightFromHip: -0.26, pelvisSlope: 8 }],
  ] as const)('applies %s only beyond its threshold', (ruleId, boundary, triggered) => {
    expect(evaluateRules(ATTITUDE_RULES, context(boundary)).map((item) => item.ruleId)).not.toContain(ruleId);
    expect(evaluateRules(ATTITUDE_RULES, context(triggered)).map((item) => item.ruleId)).toContain(ruleId);
  });
});

import { describe, expect, it } from 'vitest';
import acceptable from '../../tests/fixtures/arabesque-acceptable.json';
import bentKnees from '../../tests/fixtures/arabesque-bent-knees.json';
import pelvisCompensation from '../../tests/fixtures/arabesque-pelvis-compensation.json';
import { measurePose, type MeasurementSet } from '../analysis/measurePose';
import { landmarkNames } from '../domain/landmarks';
import type { Landmark, SupportingSide } from '../domain/types';
import { COMMON_RULES } from './commonRules';
import { evaluateRules } from './evaluateRules';
import { ARABESQUE_RULES } from './arabesqueRules';
import type { RuleContext } from './types';

interface ArabesqueFixture {
  position: 'arabesque';
  supportingSide: SupportingSide;
  expectedRuleIds: readonly string[];
  landmarks: readonly Landmark[];
}

function fixture(value: unknown): ArabesqueFixture {
  return value as ArabesqueFixture;
}

function evaluateFixture(value: unknown) {
  const input = fixture(value);
  return evaluateRules([...COMMON_RULES, ...ARABESQUE_RULES], {
    position: input.position,
    supportingSide: input.supportingSide,
    landmarks: input.landmarks,
    measurements: measurePose(input.landmarks, input.supportingSide),
  });
}

function mirrored(value: ArabesqueFixture): ArabesqueFixture {
  return {
    ...value,
    supportingSide: value.supportingSide === 'left' ? 'right' : 'left',
    landmarks: value.landmarks.map((landmark) => ({
      ...landmark,
      x: 1 - landmark.x,
      name: landmark.name.replace(/^left|^right/, (side) => side === 'left' ? 'right' : 'left') as Landmark['name'],
    })),
  };
}

describe('Arabesque rules', () => {
  it.each([acceptable, bentKnees, pelvisCompensation])('keeps all 33 named landmarks in its fixture', (value) => {
    const input = fixture(value);
    expect(input.landmarks).toHaveLength(33);
    expect(input.landmarks.map((landmark) => landmark.name).sort()).toEqual([...landmarkNames].sort());
  });

  it('finds both bent knees even when the pose is far from the standard', () => {
    const observations = evaluateFixture(bentKnees);
    expect(observations.map((item) => item.ruleId)).toEqual(expect.arrayContaining([...fixture(bentKnees).expectedRuleIds]));
  });

  it.each([acceptable, bentKnees, pelvisCompensation])('matches the declared expected rule IDs for each fixture', (value) => {
    const input = fixture(value);
    expect(evaluateFixture(input).map((item) => item.ruleId)).toEqual(input.expectedRuleIds);
  });

  it('does not force more leg height when pelvic control is already lost', () => {
    const observations = evaluateFixture(pelvisCompensation);
    const ids = observations.map((item) => item.ruleId);
    expect(ids).toContain('arabesque-lower-leg-for-pelvis');
    expect(ids).not.toContain('arabesque-working-leg-too-low');
    expect(ids).not.toContain('arabesque-lift-working-leg');
  });

  it('leaves a stable, extended acceptable Arabesque without stability or structure findings', () => {
    const observations = evaluateFixture(acceptable);
    expect(observations.filter((item) => item.priority === 'stability' || item.priority === 'structure')).toEqual([]);
    expect(observations.map((item) => item.ruleId)).toEqual(fixture(acceptable).expectedRuleIds);
  });

  it('reports identical rule IDs after left-right mirroring', () => {
    const input = fixture(bentKnees);
    expect(evaluateFixture(input).map((item) => item.ruleId).sort())
      .toEqual(evaluateFixture(mirrored(input)).map((item) => item.ruleId).sort());
  });

  it.each([
    ['arabesque-working-knee-bent', { workingKneeAngle: 165 }, { workingKneeAngle: 164 }, ['right_hip', 'right_knee', 'right_ankle'], 'joint'],
    ['arabesque-lower-leg-for-pelvis', { workingAnkleHeightFromHip: 0, pelvisSlope: 11 }, { workingAnkleHeightFromHip: 0.01, pelvisSlope: 11 }, ['left_hip', 'right_hip', 'right_ankle'], 'region'],
    ['arabesque-working-leg-too-low', { workingAnkleHeightFromHip: -0.30, pelvisSlope: 0 }, { workingAnkleHeightFromHip: -0.31, pelvisSlope: 8 }, ['right_hip', 'right_knee', 'right_ankle'], 'region'],
    ['arabesque-torso-collapse', { torsoLateralOffset: -0.18 }, { torsoLateralOffset: -0.19 }, ['left_shoulder', 'right_shoulder', 'left_hip', 'right_hip'], 'region'],
  ] as const)('applies %s only beyond its threshold with reviewable evidence annotations', (ruleId, boundary, triggered, evidence, annotationType) => {
    const input = fixture(acceptable);
    const measurements = measurePose(input.landmarks, input.supportingSide);
    const context = (overrides: Partial<MeasurementSet>): RuleContext => ({
      position: 'arabesque', supportingSide: 'left', landmarks: input.landmarks,
      measurements: { ...measurements, ...overrides },
    });
    const atBoundary = evaluateRules(ARABESQUE_RULES, context(boundary));
    const observation = evaluateRules(ARABESQUE_RULES, context(triggered)).find((item) => item.ruleId === ruleId);

    expect(atBoundary.find((item) => item.ruleId === ruleId)).toBeUndefined();
    expect(observation).toMatchObject({
      evidence,
      annotation: [expect.objectContaining({ type: annotationType })],
    });
  });

  it('suppresses the low-leg suggestion once pelvis slope exceeds 8 degrees', () => {
    const input = fixture(acceptable);
    const measurements = measurePose(input.landmarks, input.supportingSide);
    const observations = evaluateRules(ARABESQUE_RULES, {
      position: 'arabesque', supportingSide: 'left', landmarks: input.landmarks,
      measurements: { ...measurements, workingAnkleHeightFromHip: -0.31, pelvisSlope: 8.01 },
    });

    expect(observations.map((item) => item.ruleId)).not.toContain('arabesque-working-leg-too-low');
  });
});

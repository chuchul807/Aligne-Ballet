import { describe, expect, it } from 'vitest';
import acceptable from '../../tests/fixtures/arabesque-acceptable.json';
import bentKnees from '../../tests/fixtures/arabesque-bent-knees.json';
import pelvisCompensation from '../../tests/fixtures/arabesque-pelvis-compensation.json';
import { landmarkNames } from '../domain/landmarks';
import type { Landmark, SupportingSide } from '../domain/types';
import { measuredPose, type MeasurementValueOverrides } from '../../tests/builders/measurements';
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
  const view = 'three-quarter-side';
  const { reliability, measurements } = measuredPose(input.landmarks, input.supportingSide, view);
  return evaluateRules([...COMMON_RULES, ...ARABESQUE_RULES], {
    position: input.position,
    supportingSide: input.supportingSide,
    view,
    landmarks: input.landmarks,
    reliability,
    measurements,
  });
}

function findingIds(observations: ReturnType<typeof evaluateFixture>): readonly string[] {
  return observations.filter((item) => item.assessability === 'assessable').map((item) => item.ruleId);
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

function fixtureForSupportingSide(supportingSide: SupportingSide): ArabesqueFixture {
  const input = fixture(acceptable);
  return supportingSide === 'left' ? input : mirrored(input);
}

describe('Arabesque rules', () => {
  it.each([acceptable, bentKnees, pelvisCompensation])('keeps all 33 named landmarks in its fixture', (value) => {
    const input = fixture(value);
    expect(input.landmarks).toHaveLength(33);
    expect(input.landmarks.map((landmark) => landmark.name).sort()).toEqual([...landmarkNames].sort());
  });

  it('finds the reliable bent working knee and withholds the edge-cropped supporting chain', () => {
    const observations = evaluateFixture(bentKnees);
    expect(findingIds(observations)).toEqual(expect.arrayContaining([...fixture(bentKnees).expectedRuleIds]));
    expect(observations.find((item) => item.ruleId === 'supporting-knee-bent'))
      .toMatchObject({ assessability: 'unassessable' });
  });

  it.each([acceptable, bentKnees, pelvisCompensation])('matches the declared expected rule IDs for each fixture', (value) => {
    const input = fixture(value);
    expect(findingIds(evaluateFixture(input))).toEqual(input.expectedRuleIds);
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
    expect(observations.filter((item) => item.assessability === 'assessable' && (item.priority === 'stability' || item.priority === 'structure'))).toEqual([]);
    expect(findingIds(observations)).toEqual(fixture(acceptable).expectedRuleIds);
  });

  it('reports identical rule IDs after left-right mirroring', () => {
    const input = fixture(bentKnees);
    expect([...findingIds(evaluateFixture(input))].sort())
      .toEqual([...findingIds(evaluateFixture(mirrored(input)))].sort());
  });

  it.each([
    ['arabesque-working-knee-bent', { workingKneeAngle: 165 }, { workingKneeAngle: 164 }, ['right_hip', 'right_knee', 'right_ankle'], 'joint'],
    ['arabesque-lower-leg-for-pelvis', { workingAnkleHeightFromHip: 0, pelvisSlope: 11 }, { workingAnkleHeightFromHip: 0.01, pelvisSlope: 11 }, ['left_hip', 'right_hip', 'right_ankle'], 'region'],
    ['arabesque-working-leg-too-low', { workingAnkleHeightFromHip: -0.30, pelvisSlope: 0 }, { workingAnkleHeightFromHip: -0.31, pelvisSlope: 8 }, ['right_hip', 'right_knee', 'right_ankle'], 'region'],
    ['arabesque-torso-collapse', { torsoLateralOffset: -0.18 }, { torsoLateralOffset: -0.19 }, ['left_shoulder', 'right_shoulder', 'left_hip', 'right_hip'], 'region'],
  ] as const)('applies %s only beyond its threshold with reviewable evidence annotations', (ruleId, boundary, triggered, evidence, annotationType) => {
    const input = fixture(acceptable);
    const context = (overrides: MeasurementValueOverrides): RuleContext => {
      const view = 'three-quarter-side';
      const { reliability, measurements } = measuredPose(input.landmarks, input.supportingSide, view, overrides);
      return { position: 'arabesque', supportingSide: 'left', view, landmarks: input.landmarks, reliability, measurements };
    };
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
    const view = 'three-quarter-side';
    const { reliability, measurements } = measuredPose(input.landmarks, input.supportingSide, view, {
      workingAnkleHeightFromHip: -0.31,
      pelvisSlope: 8.01,
    });
    const observations = evaluateRules(ARABESQUE_RULES, {
      position: 'arabesque', supportingSide: 'left', view, landmarks: input.landmarks,
      reliability, measurements,
    });

    expect(observations.map((item) => item.ruleId)).not.toContain('arabesque-working-leg-too-low');
  });

  it.each(['left', 'right'] as const)('keeps missing-working-leg fallback evidence unbiased for %s support', (supportingSide) => {
    const input = fixtureForSupportingSide(supportingSide);
    const workingSide = supportingSide === 'left' ? 'right' : 'left';
    const missingAnkle = `${workingSide}_ankle` as Landmark['name'];
    const landmarks = input.landmarks.filter((landmark) => landmark.name !== missingAnkle);
    const view = 'three-quarter-side';
    const { reliability, measurements } = measuredPose(landmarks, supportingSide, view);
    const observations = evaluateRules(ARABESQUE_RULES, {
      position: 'arabesque', supportingSide, view, landmarks, reliability, measurements,
    });

    const fallbackEvidence = [
      ['arabesque-working-knee-bent', ['left_hip', 'left_knee', 'left_ankle', 'right_hip', 'right_knee', 'right_ankle']],
      ['arabesque-lower-leg-for-pelvis', ['left_hip', 'right_hip', 'left_ankle', 'right_ankle']],
      ['arabesque-working-leg-too-low', ['left_hip', 'left_knee', 'left_ankle', 'right_hip', 'right_knee', 'right_ankle']],
    ] as const;
    for (const [ruleId, expectedEvidence] of fallbackEvidence) {
      const observation = observations.find((item) => item.ruleId === ruleId);
      expect(observation).toMatchObject({
        assessability: 'unassessable',
        evidence: expectedEvidence,
      });
      expect(observation?.evidence).toContain(missingAnkle);
    }
  });

  it.each(['left', 'right'] as const)('uses only the actual working leg in assessable evidence and annotations for %s support', (supportingSide) => {
    const input = fixtureForSupportingSide(supportingSide);
    const workingSide = supportingSide === 'left' ? 'right' : 'left';
    const legEvidence = [`${workingSide}_hip`, `${workingSide}_knee`, `${workingSide}_ankle`] as Landmark['name'][];
    const cases = [
      ['arabesque-working-knee-bent', { workingKneeAngle: 164 }, legEvidence, 'joint', [`${workingSide}_knee`]],
      ['arabesque-lower-leg-for-pelvis', { workingAnkleHeightFromHip: 0.01, pelvisSlope: 11 }, ['left_hip', 'right_hip', `${workingSide}_ankle`], 'region', ['left_hip', 'right_hip', `${workingSide}_ankle`]],
      ['arabesque-working-leg-too-low', { workingAnkleHeightFromHip: -0.31, pelvisSlope: 8 }, legEvidence, 'region', legEvidence],
      ['arabesque-torso-collapse', { torsoLateralOffset: -0.19 }, ['left_shoulder', 'right_shoulder', 'left_hip', 'right_hip'], 'region', ['left_shoulder', 'right_shoulder', 'left_hip', 'right_hip']],
    ] as const;

    for (const [ruleId, overrides, evidence, annotationType, annotationJoints] of cases) {
      const view = 'three-quarter-side';
      const { reliability, measurements } = measuredPose(input.landmarks, supportingSide, view, overrides);
      const observation = evaluateRules(ARABESQUE_RULES, {
        position: 'arabesque', supportingSide, view, landmarks: input.landmarks,
        reliability, measurements,
      }).find((item) => item.ruleId === ruleId);

      expect(observation).toMatchObject({ assessability: 'assessable', evidence });
      expect(observation?.annotation).toEqual([{
        observationId: ruleId,
        type: annotationType,
        joints: annotationJoints,
      }]);
    }
  });
});

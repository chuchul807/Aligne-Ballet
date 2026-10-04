import { describe, expect, it } from 'vitest';
import { landmarkPerson, mirroredPerson } from '../../tests/builders/landmarks';
import { measuredPose, type MeasurementValueOverrides } from '../../tests/builders/measurements';
import type { Landmark, SupportingSide } from '../domain/types';
import { COMMON_RULES } from './commonRules';
import { evaluateRules } from './evaluateRules';
import { A_LA_SECONDE_RULES } from './aLaSecondeRules';
import type { RuleContext } from './types';

const safeMeasurements: MeasurementValueOverrides = {
  supportingKneeAngle: 170,
  workingKneeAngle: 170,
  workingFootPointAngle: 170,
  workingHeelDepthCue: 0.10,
  workingAnkleOutwardOffset: 0.30,
  pelvisSlope: 0,
  workingAnkleHeightFromHip: 0,
};

function aLaSecondeLandmarks(
  placement: 'ground-side' | 'vertical-low' | 'high',
  heelDepth = -0.05,
): readonly Landmark[] {
  const geometries: Record<typeof placement, Partial<Record<Landmark['name'], readonly [number, number]>>> = {
    'ground-side': {
      right_knee: [0.69, 0.79], right_ankle: [0.78, 0.88],
      right_heel: [0.82, 0.92], right_foot_index: [0.86, 0.96],
    },
    'vertical-low': {
      right_knee: [0.60, 0.79], right_ankle: [0.60, 0.88],
      right_heel: [0.59, 0.91], right_foot_index: [0.60, 0.96],
    },
    high: {
      right_knee: [0.60, 0.50], right_ankle: [0.60, 0.30],
      right_heel: [0.59, 0.26], right_foot_index: [0.60, 0.20],
    },
  };
  const geometry = geometries[placement];

  return landmarkPerson().map((point) => {
    const coordinates = geometry[point.name];
    if (!coordinates) return point;
    const z = point.name === 'right_heel' ? heelDepth
      : point.name === 'right_foot_index' ? 0.05
        : 0;
    const [x, y] = coordinates;
    return { ...point, x, y, z };
  });
}

function context(
  overrides: MeasurementValueOverrides = {},
  supportingSide: SupportingSide = 'left',
): RuleContext {
  const base = landmarkPerson();
  const landmarks = supportingSide === 'left' ? base : mirroredPerson(base);
  const { reliability, measurements } = measuredPose(landmarks, supportingSide, 'front', {
    ...safeMeasurements,
    ...overrides,
  });
  return {
    position: 'a-la-seconde', supportingSide, view: 'front', landmarks, reliability, measurements,
  };
}

describe('À la seconde rules', () => {
  it('accepts every working-leg height when the visible lines remain controlled', () => {
    for (const workingAnkleHeightFromHip of [-1, 0, 0.75, 1.5]) {
      const findings = evaluateRules(A_LA_SECONDE_RULES, context({ workingAnkleHeightFromHip }));
      expect(findings.filter((item) => item.assessability === 'assessable')).toEqual([]);
    }
  });

  it('accepts a side tendu and a near-vertical high leg, but rejects a low vertical leg', () => {
    const idsFor = (placement: 'ground-side' | 'vertical-low' | 'high') => {
      const landmarks = aLaSecondeLandmarks(placement);
      const { reliability, measurements } = measuredPose(landmarks, 'left', 'front');
      return evaluateRules(A_LA_SECONDE_RULES, {
        position: 'a-la-seconde', supportingSide: 'left', view: 'front',
        landmarks, reliability, measurements,
      }).filter((item) => item.assessability === 'assessable').map((item) => item.ruleId);
    };

    expect(idsFor('ground-side')).not.toContain('a-la-seconde-working-leg-not-side');
    expect(idsFor('high')).not.toContain('a-la-seconde-working-leg-not-side');
    expect(idsFor('vertical-low')).toContain('a-la-seconde-working-leg-not-side');
  });

  it('checks both straight legs while leaving the common supporting-leg rule active', () => {
    const observations = evaluateRules(
      [...COMMON_RULES, ...A_LA_SECONDE_RULES],
      context({ supportingKneeAngle: 164, workingKneeAngle: 164 }),
    );
    expect(observations.map((item) => item.ruleId)).toEqual(expect.arrayContaining([
      'supporting-knee-bent',
      'a-la-seconde-working-knee-bent',
    ]));
  });

  it('requires a pointed working foot and a forward heel-depth turnout cue', () => {
    const ids = evaluateRules(A_LA_SECONDE_RULES, context({
      workingFootPointAngle: 149,
      workingHeelDepthCue: 0.019,
    })).map((item) => item.ruleId);
    expect(ids).toEqual(expect.arrayContaining([
      'a-la-seconde-foot-not-pointed',
      'a-la-seconde-turnout-not-visible',
    ]));
  });

  it('distinguishes a forward turned-out heel from a clearly turned-in heel after mirroring', () => {
    const idsFor = (heelDepth: number, side: SupportingSide) => {
      const left = aLaSecondeLandmarks('ground-side', heelDepth);
      const landmarks = side === 'left' ? left : mirroredPerson(left);
      const { reliability, measurements } = measuredPose(landmarks, side, 'front');
      expect(measurements.workingHeelDepthCue).toMatchObject({
        value: expect.closeTo((0.05 - heelDepth) / 0.2, 5),
        assessability: 'assessable',
      });
      return evaluateRules(A_LA_SECONDE_RULES, {
        position: 'a-la-seconde', supportingSide: side, view: 'front',
        landmarks, reliability, measurements,
      }).filter((item) => item.assessability === 'assessable').map((item) => item.ruleId);
    };

    for (const side of ['left', 'right'] as const) {
      expect(idsFor(-0.05, side)).not.toContain('a-la-seconde-turnout-not-visible');
      expect(idsFor(0.10, side)).toContain('a-la-seconde-turnout-not-visible');
    }
  });

  it('allows more visible pelvic slope as the working foot rises', () => {
    const low = evaluateRules(A_LA_SECONDE_RULES, context({
      workingAnkleHeightFromHip: 0,
      pelvisSlope: 9,
    })).map((item) => item.ruleId);
    const high = evaluateRules(A_LA_SECONDE_RULES, context({
      workingAnkleHeightFromHip: 1,
      pelvisSlope: 15,
    })).map((item) => item.ruleId);
    const excessiveHigh = evaluateRules(A_LA_SECONDE_RULES, context({
      workingAnkleHeightFromHip: 1,
      pelvisSlope: 17,
    })).map((item) => item.ruleId);

    expect(low).toContain('a-la-seconde-pelvis-out-of-line');
    expect(high).not.toContain('a-la-seconde-pelvis-out-of-line');
    expect(excessiveHigh).toContain('a-la-seconde-pelvis-out-of-line');
  });

  it('keeps the working-leg findings symmetric across supporting sides', () => {
    const overrides = { workingKneeAngle: 164, workingFootPointAngle: 149 };
    const ids = (side: SupportingSide) => evaluateRules(A_LA_SECONDE_RULES, context(overrides, side))
      .filter((item) => item.assessability === 'assessable')
      .map((item) => item.ruleId)
      .sort();
    expect(ids('right')).toEqual(ids('left'));
  });
});

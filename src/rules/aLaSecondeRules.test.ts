import { describe, expect, it } from 'vitest';
import { landmarkPerson, mirroredPerson } from '../../tests/builders/landmarks';
import { measuredPose, type MeasurementValueOverrides } from '../../tests/builders/measurements';
import type { Landmark, SupportingSide } from '../domain/types';
import { composeFeedback, type AssessmentCoverage } from '../feedback/composeFeedback';
import { COMMON_RULES } from './commonRules';
import { evaluateRules } from './evaluateRules';
import { A_LA_SECONDE_RULES } from './aLaSecondeRules';
import type { RuleContext } from './types';

const safeMeasurements: MeasurementValueOverrides = {
  supportingKneeAngle: 170,
  supportingKneeForwardDepthCue: 0.10,
  workingKneeAngle: 170,
  workingKneeForwardDepthCue: 0.10,
  workingFootPointAngle: 170,
  workingHeelDepthCue: 0.10,
  workingHeelVisibilityCue: 0.10,
  workingAnkleOutwardOffset: 0.30,
  pelvisSlope: 0,
  workingAnkleHeightFromHip: 0,
};

const allRegionsAssessable: AssessmentCoverage = {
  'supporting-leg': 'assessable', 'working-leg': 'assessable', pelvis: 'assessable',
  torso: 'assessable', 'shoulders-arms': 'assessable', head: 'assessable', feet: 'assessable',
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
      context({ supportingKneeAngle: 150, workingKneeAngle: 150 }),
    );
    expect(observations.map((item) => item.ruleId)).toEqual(expect.arrayContaining([
      'supporting-knee-bent',
      'a-la-seconde-working-knee-bent',
    ]));
  });

  it('does not call a hyperextended or mildly displaced working knee bent from the front', () => {
    const hasFinding = (workingKneeAngle: number, workingKneeForwardDepthCue: number) => evaluateRules(
      A_LA_SECONDE_RULES,
      context({ workingKneeAngle, workingKneeForwardDepthCue }),
    ).some((item) => item.ruleId === 'a-la-seconde-working-knee-bent');

    expect(hasFinding(150, -0.10)).toBe(false);
    expect(hasFinding(160, 0.10)).toBe(false);
    expect(hasFinding(150, 0.10)).toBe(true);
  });

  it('requires a pointed working foot and a visible heel turnout cue', () => {
    const ids = evaluateRules(A_LA_SECONDE_RULES, context({
      workingFootPointAngle: 149,
      workingHeelVisibilityCue: 0.049,
    })).map((item) => item.ruleId);
    expect(ids).toEqual(expect.arrayContaining([
      'a-la-seconde-foot-not-pointed',
      'a-la-seconde-turnout-not-visible',
    ]));
  });

  it('accepts a clearly visible heel even when the model depth cue is weak', () => {
    const ids = evaluateRules(A_LA_SECONDE_RULES, context({
      workingHeelDepthCue: -0.20,
      workingHeelVisibilityCue: 0.08,
    })).map((item) => item.ruleId);

    expect(ids).not.toContain('a-la-seconde-turnout-not-visible');
  });

  it('accepts the calibrated reference alignment while retaining severe torso and support findings', () => {
    const reference = evaluateRules([...COMMON_RULES, ...A_LA_SECONDE_RULES], context({
      torsoLateralOffset: 0.11,
      frontalSupportingHipAnkleOffset: 0.23,
      pelvisSlope: 10.4,
      workingAnkleHeightFromHip: -1.37,
      workingAnkleOutwardOffset: 0.76,
    })).filter((item) => item.assessability === 'assessable').map((item) => item.ruleId);
    const severe = evaluateRules([...COMMON_RULES, ...A_LA_SECONDE_RULES], context({
      torsoLateralOffset: 0.31,
      frontalSupportingHipAnkleOffset: 0.38,
    })).filter((item) => item.assessability === 'assessable').map((item) => item.ruleId);

    expect(reference).not.toContain('torso-off-support');
    expect(reference).not.toContain('supporting-lateral-offset');
    expect(reference).not.toContain('a-la-seconde-pelvis-out-of-line');
    expect(severe).toEqual(expect.arrayContaining([
      'torso-off-support',
      'supporting-lateral-offset',
    ]));
  });

  it('allows natural pelvic adjustment as the side leg approaches and rises above horizontal', () => {
    const idsFor = (workingAnkleHeightFromHip: number, pelvisSlope: number) => evaluateRules(
      A_LA_SECONDE_RULES,
      context({ workingAnkleHeightFromHip, workingAnkleOutwardOffset: 1, pelvisSlope }),
    ).map((item) => item.ruleId);

    expect(idsFor(-1.1, 13)).toContain('a-la-seconde-pelvis-out-of-line');
    expect(idsFor(-0.1, 22)).not.toContain('a-la-seconde-pelvis-out-of-line');
    expect(idsFor(-0.1, 26)).toContain('a-la-seconde-pelvis-out-of-line');
    expect(idsFor(1, 29)).not.toContain('a-la-seconde-pelvis-out-of-line');
    expect(idsFor(1, 31)).toContain('a-la-seconde-pelvis-out-of-line');
  });

  it('prioritises straight legs, then foot point and turnout, before alignment suggestions', () => {
    const topRuleIds = (overrides: MeasurementValueOverrides) => composeFeedback(
      evaluateRules([...COMMON_RULES, ...A_LA_SECONDE_RULES], context({
        torsoLateralOffset: 0.31,
        frontalSupportingHipAnkleOffset: 0.38,
        pelvisSlope: 31,
        workingAnkleHeightFromHip: 0,
        workingAnkleOutwardOffset: 1,
        ...overrides,
      })),
      allRegionsAssessable,
    ).topCorrections.map((item) => item.ruleId);

    expect(topRuleIds({ workingKneeAngle: 150, workingFootPointAngle: 130 })[0])
      .toBe('a-la-seconde-working-knee-bent');
    expect(topRuleIds({ workingFootPointAngle: 130 })[0])
      .toBe('a-la-seconde-foot-not-pointed');
    expect(topRuleIds({ workingHeelVisibilityCue: -0.10 })[0])
      .toBe('a-la-seconde-turnout-not-visible');
  });

  it('distinguishes a visible heel from a clearly turned-in heel after mirroring', () => {
    const idsFor = (heelX: number, toeX: number, side: SupportingSide) => {
      const left = aLaSecondeLandmarks('ground-side').map((point) => {
        if (point.name === 'right_heel') return { ...point, x: heelX };
        if (point.name === 'right_foot_index') return { ...point, x: toeX };
        return point;
      });
      const landmarks = side === 'left' ? left : mirroredPerson(left);
      const { reliability, measurements } = measuredPose(landmarks, side, 'front');
      expect(measurements.workingHeelVisibilityCue).toMatchObject({
        value: expect.closeTo((toeX - heelX) / 0.2, 5),
        assessability: 'assessable',
      });
      return evaluateRules(A_LA_SECONDE_RULES, {
        position: 'a-la-seconde', supportingSide: side, view: 'front',
        landmarks, reliability, measurements,
      }).filter((item) => item.assessability === 'assessable').map((item) => item.ruleId);
    };

    for (const side of ['left', 'right'] as const) {
      expect(idsFor(0.849, 0.86, side)).not.toContain('a-la-seconde-turnout-not-visible');
      expect(idsFor(0.851, 0.86, side)).toContain('a-la-seconde-turnout-not-visible');
      expect(idsFor(0.82, 0.86, side)).not.toContain('a-la-seconde-turnout-not-visible');
      expect(idsFor(0.90, 0.86, side)).toContain('a-la-seconde-turnout-not-visible');
    }
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

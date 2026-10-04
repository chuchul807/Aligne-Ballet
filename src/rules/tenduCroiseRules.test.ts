import { describe, expect, it } from 'vitest';
import { landmarkPerson, mirroredPerson } from '../../tests/builders/landmarks';
import { measuredPose, type MeasurementValueOverrides } from '../../tests/builders/measurements';
import type { SupportingSide } from '../domain/types';
import { COMMON_RULES } from './commonRules';
import { evaluateRules } from './evaluateRules';
import { TENDU_CROISE_RULES } from './tenduCroiseRules';
import type { RuleContext } from './types';

const safeMeasurements: MeasurementValueOverrides = {
  supportingKneeAngle: 170,
  workingKneeAngle: 170,
  workingFootPointAngle: 170,
  workingFootHeightFromSupportingFoot: 0.10,
  croiseCrossingSeparation: 0.20,
};

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
    position: 'tendu-croise-devant', supportingSide, view: 'front', landmarks, reliability, measurements,
  };
}

describe('Tendu croisé devant rules', () => {
  it('checks both legs for a straight line', () => {
    const observations = evaluateRules(
      [...COMMON_RULES, ...TENDU_CROISE_RULES],
      context({ supportingKneeAngle: 164, workingKneeAngle: 164 }),
    );
    expect(observations.map((item) => item.ruleId)).toEqual(expect.arrayContaining([
      'supporting-knee-bent',
      'tendu-working-knee-bent',
    ]));
  });

  it('flags an unpointed or visibly lifted working foot', () => {
    const ids = evaluateRules(TENDU_CROISE_RULES, context({
      workingFootPointAngle: 149,
      workingFootHeightFromSupportingFoot: 0.181,
    })).map((item) => item.ruleId);
    expect(ids).toEqual(expect.arrayContaining([
      'tendu-foot-not-pointed',
      'tendu-working-foot-lifted',
    ]));
  });

  it('requires enough visible crossing beyond the supporting leg', () => {
    const atBoundary = evaluateRules(TENDU_CROISE_RULES, context({
      croiseCrossingSeparation: 0.12,
    })).map((item) => item.ruleId);
    const tooSmall = evaluateRules(TENDU_CROISE_RULES, context({
      croiseCrossingSeparation: 0.119,
    })).map((item) => item.ruleId);

    expect(atBoundary).not.toContain('tendu-crossing-too-small');
    expect(tooSmall).toContain('tendu-crossing-too-small');
  });

  it('keeps the croise spacing and leg findings symmetric across supporting sides', () => {
    const overrides = { workingKneeAngle: 164, croiseCrossingSeparation: 0.11 };
    const ids = (side: SupportingSide) => evaluateRules(TENDU_CROISE_RULES, context(overrides, side))
      .filter((item) => item.assessability === 'assessable')
      .map((item) => item.ruleId)
      .sort();
    expect(ids('right')).toEqual(ids('left'));
  });
});

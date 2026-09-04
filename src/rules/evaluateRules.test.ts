import { describe, expect, it } from 'vitest';
import { measurePose } from '../analysis/measurePose';
import { evaluateRules } from './evaluateRules';
import { COMMON_RULES } from './commonRules';
import type { RuleContext } from './types';
import { landmarkPerson } from '../../tests/builders/landmarks';

function context(overrides: Partial<RuleContext> = {}): RuleContext {
  const landmarks = landmarkPerson();
  return {
    position: 'arabesque',
    supportingSide: 'left',
    landmarks,
    measurements: measurePose(landmarks, 'left'),
    ...overrides,
  };
}

describe('evaluateRules', () => {
  it('uses only evidence visibility for confidence, not severity', () => {
    const landmarks = landmarkPerson().map((point) => point.name === 'left_knee' ? { ...point, visibility: 0.7 } : point);
    const measurements = { ...measurePose(landmarks, 'left'), supportingKneeAngle: 0 };

    const observation = evaluateRules(COMMON_RULES, context({ landmarks, measurements }))
      .find((item) => item.ruleId === 'supporting-knee-bent');

    expect(observation).toMatchObject({ confidence: 'medium', severity: 1, assessability: 'assessable' });
  });

  it('emits one low-confidence unassessable observation for a missing required measurement', () => {
    const measurements = { ...measurePose(landmarkPerson(), 'left'), pelvisSlope: null };
    const observations = evaluateRules(COMMON_RULES, context({ measurements }));

    expect(observations.filter((item) => item.ruleId === 'pelvis-unlevel')).toEqual([
      expect.objectContaining({ assessability: 'unassessable', confidence: 'low', severity: null }),
    ]);
  });

  it('keeps common supporting-leg IDs and directions identical for either supporting side', () => {
    const left = context({ measurements: { ...measurePose(landmarkPerson(), 'left'), supportingKneeAngle: 160 } });
    const rightLandmarks = landmarkPerson().map((point) => ({ ...point, x: 1 - point.x, name: point.name.replace(/^left|^right/, (side) => side === 'left' ? 'right' : 'left') as typeof point.name }));
    const right = context({ supportingSide: 'right', landmarks: rightLandmarks, measurements: { ...measurePose(rightLandmarks, 'right'), supportingKneeAngle: 160 } });

    const finding = (value: RuleContext) => evaluateRules(COMMON_RULES, value).find((item) => item.ruleId === 'supporting-knee-bent');
    expect(finding(left)).toMatchObject({ id: 'supporting-knee-bent', direction: 'lengthen the supporting leg' });
    expect(finding(right)).toMatchObject({ id: 'supporting-knee-bent', direction: 'lengthen the supporting leg' });
  });
});

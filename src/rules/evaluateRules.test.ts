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

  it('treats a non-finite required measurement as missing and emits it once', () => {
    const measurements = { ...measurePose(landmarkPerson(), 'left'), pelvisSlope: Number.NaN };
    const observations = evaluateRules(COMMON_RULES, context({ measurements }));

    expect(observations.filter((item) => item.ruleId === 'pelvis-unlevel')).toEqual([
      expect.objectContaining({ assessability: 'unassessable', severity: null }),
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

  it.each([
    ['supporting-knee-bent', 'supportingKneeAngle', 172, 171, 'lengthen the supporting leg'],
    ['pelvis-unlevel', 'pelvisSlope', 8, 9, 'level the pelvis'],
    ['shoulders-unlevel', 'shoulderSlope', 10, 11, 'lower the raised shoulder'],
    ['torso-off-support', 'torsoLateralOffset', 0.12, 0.13, 'bring the torso toward the supporting side'],
    ['supporting-ankle-not-stacked', 'supportingAnkleUnderHipOffset', 0.18, 0.19, 'bring the supporting hip over the ankle'],
    ['left-arm-line-collapsed', 'leftElbowAngle', 110, 109, 'lengthen the left arm'],
    ['right-arm-line-collapsed', 'rightElbowAngle', 110, 109, 'lengthen the right arm'],
    ['head-extreme-lateral-tilt', 'headTiltFromTorso', 25, 26, 'bring the head toward the torso axis'],
  ] as const)('applies %s only beyond its threshold with a bounded severity', (ruleId, key, boundary, triggered, direction) => {
    const base = measurePose(landmarkPerson(), 'left');
    const atBoundary = evaluateRules(COMMON_RULES, context({ measurements: { ...base, [key]: boundary } }));
    const beyond = evaluateRules(COMMON_RULES, context({ measurements: { ...base, [key]: triggered } }));
    const finding = beyond.find((item) => item.ruleId === ruleId);

    expect(atBoundary.find((item) => item.ruleId === ruleId)).toBeUndefined();
    expect(finding).toMatchObject({ ruleId, direction, assessability: 'assessable' });
    if (finding?.assessability === 'assessable') {
      expect(finding.severity).toBeGreaterThanOrEqual(0);
      expect(finding.severity).toBeLessThanOrEqual(1);
    }
  });

  it('detects torso displacement on either side of support while preserving the same correction direction', () => {
    const base = measurePose(landmarkPerson(), 'left');
    const directions = [-0.13, 0.13].map((torsoLateralOffset) => evaluateRules(
      COMMON_RULES,
      context({ measurements: { ...base, torsoLateralOffset } }),
    ).find((item) => item.ruleId === 'torso-off-support'));

    expect(directions).toEqual([
      expect.objectContaining({ direction: 'bring the torso toward the supporting side' }),
      expect.objectContaining({ direction: 'bring the torso toward the supporting side' }),
    ]);
  });

  it('does not let an infinite common-rule measurement become a correction', () => {
    const measurements = { ...measurePose(landmarkPerson(), 'left'), supportingAnkleUnderHipOffset: Number.POSITIVE_INFINITY };
    const observations = evaluateRules(COMMON_RULES, context({ measurements }));

    expect(observations.filter((item) => item.ruleId === 'supporting-ankle-not-stacked')).toEqual([
      expect.objectContaining({ assessability: 'unassessable', severity: null }),
    ]);
  });
});

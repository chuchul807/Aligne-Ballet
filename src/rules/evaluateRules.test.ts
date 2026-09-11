import { describe, expect, it } from 'vitest';
import { measurePose } from '../analysis/measurePose';
import type { Confidence, MeasurementSet, PoseMeasurement } from '../domain/types';
import { composeFeedback, type AssessmentCoverage } from '../feedback/composeFeedback';
import { evaluateLandmarkReliability } from '../reliability/evaluateLandmarkReliability';
import { landmarkPerson, mirroredPerson } from '../../tests/builders/landmarks';
import { COMMON_RULES } from './commonRules';
import { evaluateRules } from './evaluateRules';
import type { RuleContext } from './types';

const allRegionsAssessable: AssessmentCoverage = {
  'supporting-leg': 'assessable', 'working-leg': 'assessable', pelvis: 'assessable',
  torso: 'assessable', 'shoulders-arms': 'assessable', head: 'assessable', feet: 'assessable',
};

function context(overrides: Partial<RuleContext> = {}): RuleContext {
  const landmarks = landmarkPerson();
  const view = overrides.view ?? 'front';
  const reliability = evaluateLandmarkReliability(landmarks, view);
  const measured = measurePose(landmarks, 'left', reliability, view);
  return {
    position: 'arabesque', supportingSide: 'left', view, landmarks, reliability,
    measurements: {
      ...measured,
      torsoLateralOffset: measurementWithValue(measured.torsoLateralOffset, 0),
    },
    ...overrides,
  };
}

function measurementWithValue(
  measurement: PoseMeasurement,
  value: number,
  confidence: Confidence = 'high',
): PoseMeasurement {
  return { ...measurement, value, confidence, assessability: 'assessable' };
}

function contextWithMeasurement(
  key: keyof MeasurementSet,
  value: number,
  confidence: Confidence = 'high',
): RuleContext {
  const base = context();
  return {
    ...base,
    measurements: {
      ...base.measurements,
      [key]: measurementWithValue(base.measurements[key], value, confidence),
    },
  };
}

describe('evaluateRules', () => {
  it('uses reliability and measurement confidence rather than severity', () => {
    const landmarks = landmarkPerson().map((point) => point.name === 'left_knee'
      ? { ...point, visibility: 0.7 }
      : point);
    const reliability = evaluateLandmarkReliability(landmarks, 'front');
    const base = measurePose(landmarks, 'left', reliability, 'front');
    const measurements = {
      ...base,
      supportingKneeAngle: measurementWithValue(base.supportingKneeAngle, 0, 'medium'),
    };
    const observation = evaluateRules(COMMON_RULES, context({ landmarks, reliability, measurements }))
      .find((item) => item.ruleId === 'supporting-knee-bent');

    expect(observation).toMatchObject({ confidence: 'medium', severity: 1, assessability: 'assessable' });
  });

  it('emits one low-confidence unassessable observation for an unassessable required measurement', () => {
    const base = context();
    const measurements = {
      ...base.measurements,
      pelvisSlope: { ...base.measurements.pelvisSlope, value: null, assessability: 'unassessable' as const },
    };
    const observations = evaluateRules(COMMON_RULES, { ...base, measurements });

    expect(observations.filter((item) => item.ruleId === 'pelvis-unlevel')).toEqual([
      expect.objectContaining({ assessability: 'unassessable', confidence: 'low', severity: null }),
    ]);
  });

  it('treats a non-finite required measurement value as unusable and emits it once', () => {
    const base = context();
    const measurements = {
      ...base.measurements,
      pelvisSlope: { ...base.measurements.pelvisSlope, value: Number.NaN },
    };
    const observations = evaluateRules(COMMON_RULES, { ...base, measurements });

    expect(observations.filter((item) => item.ruleId === 'pelvis-unlevel')).toEqual([
      expect.objectContaining({ assessability: 'unassessable', severity: null }),
    ]);
  });

  it('keeps common supporting-leg IDs and directions identical for either supporting side', () => {
    const left = contextWithMeasurement('supportingKneeAngle', 160);
    const rightLandmarks = mirroredPerson(landmarkPerson());
    const rightReliability = evaluateLandmarkReliability(rightLandmarks, 'front');
    const rightBase = measurePose(rightLandmarks, 'right', rightReliability, 'front');
    const right = context({
      supportingSide: 'right', landmarks: rightLandmarks, reliability: rightReliability,
      measurements: {
        ...rightBase,
        supportingKneeAngle: measurementWithValue(rightBase.supportingKneeAngle, 160),
      },
    });

    const finding = (value: RuleContext) => evaluateRules(COMMON_RULES, value)
      .find((item) => item.ruleId === 'supporting-knee-bent');
    expect(finding(left)).toMatchObject({ id: 'supporting-knee-bent', direction: 'lengthen the supporting leg' });
    expect(finding(right)).toMatchObject({ id: 'supporting-knee-bent', direction: 'lengthen the supporting leg' });
  });

  it.each([
    [164.99, true], [165, false], [170, false], [174.99, false], [175, false],
  ])('treats supporting-knee angle %s conservatively', (angle, expected) => {
    const observations = evaluateRules(COMMON_RULES, contextWithMeasurement('supportingKneeAngle', angle));
    expect(observations.some((item) => item.ruleId === 'supporting-knee-bent')).toBe(expected);
  });

  it.each([
    ['pelvis-unlevel', 'pelvisSlope', 8, 9, 'level the pelvis'],
    ['shoulders-unlevel', 'shoulderSlope', 10, 11, 'lower the raised shoulder'],
    ['torso-off-support', 'torsoLateralOffset', 0.12, 0.13, 'bring the torso toward the supporting side'],
    ['supporting-lateral-offset', 'frontalSupportingHipAnkleOffset', 0.18, 0.19, 'bring the supporting hip and ankle into closer side-to-side alignment'],
    ['left-arm-line-collapsed', 'leftElbowAngle', 110, 109, 'lengthen the left arm'],
    ['right-arm-line-collapsed', 'rightElbowAngle', 110, 109, 'lengthen the right arm'],
    ['head-extreme-lateral-tilt', 'headTiltFromTorso', 25, 26, 'bring the head toward the torso axis'],
  ] as const)('applies %s only beyond its threshold with a bounded severity', (ruleId, key, boundary, triggered, direction) => {
    const atBoundary = evaluateRules(COMMON_RULES, contextWithMeasurement(key, boundary));
    const beyond = evaluateRules(COMMON_RULES, contextWithMeasurement(key, triggered));
    const finding = beyond.find((item) => item.ruleId === ruleId);

    expect(atBoundary.find((item) => item.ruleId === ruleId)).toBeUndefined();
    expect(finding).toMatchObject({ ruleId, direction, assessability: 'assessable' });
    if (finding?.assessability === 'assessable') {
      expect(finding.severity).toBeGreaterThanOrEqual(0);
      expect(finding.severity).toBeLessThanOrEqual(1);
    }
  });

  it('detects torso displacement on either side of support while preserving the same correction direction', () => {
    const directions = [-0.13, 0.13].map((value) => evaluateRules(
      COMMON_RULES,
      contextWithMeasurement('torsoLateralOffset', value),
    ).find((item) => item.ruleId === 'torso-off-support'));

    expect(directions).toEqual([
      expect.objectContaining({ direction: 'bring the torso toward the supporting side' }),
      expect.objectContaining({ direction: 'bring the torso toward the supporting side' }),
    ]);
  });

  it('does not let an infinite common-rule measurement become a correction', () => {
    const observations = evaluateRules(
      COMMON_RULES,
      contextWithMeasurement('frontalSupportingHipAnkleOffset', Number.POSITIVE_INFINITY),
    );

    expect(observations.filter((item) => item.ruleId === 'supporting-lateral-offset')).toEqual([
      expect.objectContaining({ assessability: 'unassessable', severity: null }),
    ]);
  });

  it('does not evaluate frontal support alignment from a three-quarter-side view', () => {
    const base = context();
    const view = 'three-quarter-side';
    const reliability = evaluateLandmarkReliability(base.landmarks, view);
    const observations = evaluateRules(COMMON_RULES, {
      ...base, view, reliability,
      measurements: measurePose(base.landmarks, 'left', reliability, view),
    });

    expect(observations.find((item) => item.ruleId === 'supporting-lateral-offset'))
      .toMatchObject({ assessability: 'unassessable' });
  });

  it('withholds a rule when its measurement is only medium confidence', () => {
    const observations = evaluateRules(COMMON_RULES, contextWithMeasurement('pelvisSlope', 12, 'medium'));
    expect(composeFeedback(observations, allRegionsAssessable).topCorrections).toEqual([]);
  });
});

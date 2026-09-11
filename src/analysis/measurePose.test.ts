import { describe, expect, it } from 'vitest';
import { measurePose } from './measurePose';
import { landmarkPerson, mirroredPerson } from '../../tests/builders/landmarks';
import { evaluateLandmarkReliability } from '../reliability/evaluateLandmarkReliability';

describe('measurePose', () => {
  function measurementsFor(
    landmarks = landmarkPerson(),
    supportingSide: 'left' | 'right' = 'left',
    view: 'front' | 'three-quarter-side' = 'front',
  ) {
    return measurePose(
      landmarks,
      supportingSide,
      evaluateLandmarkReliability(landmarks, view),
      view,
    );
  }

  it('returns value, evidence, confidence, and assessability for a reliable knee', () => {
    const landmarks = landmarkPerson();
    const reliability = evaluateLandmarkReliability(landmarks, 'front');
    const measurements = measurePose(landmarks, 'left', reliability, 'front');

    expect(measurements.supportingKneeAngle).toMatchObject({
      value: expect.any(Number),
      assessability: 'assessable',
      confidence: 'high',
      evidence: ['left_hip', 'left_knee', 'left_ankle'],
    });
  });

  it('withholds a number when one evidence landmark is unreliable', () => {
    const landmarks = landmarkPerson().map((point) => point.name === 'left_knee'
      ? { ...point, x: 0.95, visibility: 0.99 }
      : point);
    const measurements = measurePose(
      landmarks,
      'left',
      evaluateLandmarkReliability(landmarks, 'front'),
      'front',
    );

    expect(measurements.supportingKneeAngle).toMatchObject({
      value: null,
      assessability: 'unassessable',
    });
  });

  it('marks frontal-only support offset unassessable in a three-quarter view', () => {
    const landmarks = landmarkPerson();
    const measurements = measurePose(
      landmarks,
      'left',
      evaluateLandmarkReliability(landmarks, 'three-quarter-side'),
      'three-quarter-side',
    );

    expect(measurements.frontalSupportingHipAnkleOffset).toMatchObject({
      value: null,
      assessability: 'unassessable',
      reason: 'unsupported-view',
    });
  });

  it('normalises measurements and mirrors supporting-side semantics', () => {
    const left = measurementsFor(landmarkPerson(), 'left');
    const right = measurementsFor(mirroredPerson(landmarkPerson()), 'right');

    expect(left.torsoLength.value).toBeCloseTo(0.4, 5);
    for (const key of Object.keys(left) as (keyof typeof left)[]) {
      const leftValue = left[key].value;
      const rightValue = right[key].value;
      if (leftValue === null) expect(rightValue).toBeNull();
      else expect(rightValue).toBeCloseTo(leftValue, 5);
    }
    expect(right.supportingKneeAngle.value).toBeCloseTo(left.supportingKneeAngle.value!, 5);
    expect(right.workingKneeAngle.value).toBeCloseTo(left.workingKneeAngle.value!, 5);
    expect(right.frontalSupportingHipAnkleOffset.value).toBeCloseTo(
      left.frontalSupportingHipAnkleOffset.value!,
      5,
    );
  });

  it('keeps an unavailable measurement null when a required landmark is absent', () => {
    const measurements = measurementsFor(landmarkPerson().filter((point) => point.name !== 'left_ankle'));

    expect(measurements.supportingKneeAngle.value).toBeNull();
    expect(measurements.frontalSupportingHipAnkleOffset.value).toBeNull();
  });

  it('measures torso offset from the selected supporting hip in canonical working-leg direction', () => {
    const left = landmarkPerson().map((point) => point.name === 'left_shoulder' || point.name === 'right_shoulder'
      ? { ...point, x: point.x + 0.08 } : point);
    const right = mirroredPerson(left);

    const expected = 0.18 / Math.hypot(0.4, 0.08);
    expect(measurementsFor(left, 'left').torsoLateralOffset.value).toBeCloseTo(expected, 5);
    expect(measurementsFor(right, 'right').torsoLateralOffset.value).toBeCloseTo(expected, 5);
  });

  it('measures working-knee height from the working hip and preserves it after mirroring', () => {
    const landmarks = landmarkPerson().map((point) => point.name === 'right_hip' ? { ...point, y: 0.6 } : point.name === 'right_knee' ? { ...point, y: 0.8 } : point);
    const expected = -0.2 / 0.35;
    expect(measurementsFor(landmarks, 'left').workingKneeHeightFromHip.value).toBeCloseTo(expected, 5);
    expect(measurementsFor(mirroredPerson(landmarks), 'right').workingKneeHeightFromHip.value).toBeCloseTo(expected, 5);
  });

  it('returns null measurements rather than non-finite values for non-finite landmarks', () => {
    const landmarks = landmarkPerson().map((point) => point.name === 'left_hip' ? { ...point, x: Number.NaN } : point);
    const measurements = measurementsFor(landmarks);

    expect(measurements.torsoLength).toMatchObject({ value: null, assessability: 'unassessable' });
    expect(measurements.supportingKneeAngle).toMatchObject({ value: null, assessability: 'unassessable' });
    expect(measurements.pelvisSlope).toMatchObject({ value: null, assessability: 'unassessable' });
    expect(measurements.torsoLateralOffset).toMatchObject({ value: null, assessability: 'unassessable' });
  });
});

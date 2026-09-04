import { describe, expect, it } from 'vitest';
import { measurePose } from './measurePose';
import { landmarkPerson, mirroredPerson } from '../../tests/builders/landmarks';

describe('measurePose', () => {
  it('normalises measurements and mirrors supporting-side semantics', () => {
    const left = measurePose(landmarkPerson(), 'left');
    const right = measurePose(mirroredPerson(landmarkPerson()), 'right');

    expect(left.torsoLength).toBeCloseTo(0.4, 5);
    for (const key of Object.keys(left) as (keyof typeof left)[]) {
      const leftValue = left[key];
      const rightValue = right[key];
      if (leftValue === null) expect(rightValue).toBeNull();
      else expect(rightValue).toBeCloseTo(leftValue, 5);
    }
  });

  it('keeps an unavailable measurement null when a required landmark is absent', () => {
    const measurements = measurePose(landmarkPerson().filter((point) => point.name !== 'left_ankle'), 'left');

    expect(measurements.supportingKneeAngle).toBeNull();
    expect(measurements.supportingAnkleUnderHipOffset).toBeNull();
  });

  it('measures torso offset from the selected supporting hip in canonical working-leg direction', () => {
    const left = landmarkPerson().map((point) => point.name === 'left_shoulder' || point.name === 'right_shoulder'
      ? { ...point, x: point.x + 0.08 } : point);
    const right = mirroredPerson(left);

    const expected = 0.18 / Math.hypot(0.4, 0.08);
    expect(measurePose(left, 'left').torsoLateralOffset).toBeCloseTo(expected, 5);
    expect(measurePose(right, 'right').torsoLateralOffset).toBeCloseTo(expected, 5);
  });

  it('measures working-knee height from the working hip and preserves it after mirroring', () => {
    const landmarks = landmarkPerson().map((point) => point.name === 'right_hip' ? { ...point, y: 0.6 } : point.name === 'right_knee' ? { ...point, y: 0.9 } : point);
    const expected = -0.3 / 0.35;
    expect(measurePose(landmarks, 'left').workingKneeHeightFromHip).toBeCloseTo(expected, 5);
    expect(measurePose(mirroredPerson(landmarks), 'right').workingKneeHeightFromHip).toBeCloseTo(expected, 5);
  });

  it('returns null measurements rather than non-finite values for non-finite landmarks', () => {
    const landmarks = landmarkPerson().map((point) => point.name === 'left_hip' ? { ...point, x: Number.NaN } : point);
    const measurements = measurePose(landmarks, 'left');

    expect(measurements.torsoLength).toBe(0);
    expect(measurements.supportingKneeAngle).toBeNull();
    expect(measurements.pelvisSlope).toBeNull();
    expect(measurements.torsoLateralOffset).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { measurePose } from './measurePose';
import { landmarkPerson, mirroredPerson } from '../../tests/builders/landmarks';
import { evaluateLandmarkReliability } from '../reliability/evaluateLandmarkReliability';

describe('measurePose', () => {
  function measurementsFor(
    landmarks = landmarkPerson(),
    supportingSide: 'left' | 'right' = 'left',
    view: 'front' | 'three-quarter-side' = 'front',
    sourceWidth = 1,
    sourceHeight = 1,
  ) {
    return measurePose(
      landmarks,
      supportingSide,
      evaluateLandmarkReliability(landmarks, view),
      view,
      sourceWidth,
      sourceHeight,
    );
  }

  it('returns value, evidence, confidence, and assessability for a reliable knee', () => {
    const landmarks = landmarkPerson();
    const reliability = evaluateLandmarkReliability(landmarks, 'front');
    const measurements = measurePose(landmarks, 'left', reliability, 'front', 1, 1);

    expect(measurements.supportingKneeAngle).toMatchObject({
      value: expect.any(Number),
      assessability: 'assessable',
      confidence: 'high',
      evidence: ['left_hip', 'left_knee', 'left_ankle'],
    });
  });

  it('measures whether the supporting knee moves forward or behind the hip-to-ankle depth line', () => {
    const forward = landmarkPerson().map((point) => {
      if (point.name === 'left_hip' || point.name === 'left_ankle') return { ...point, z: 0.10 };
      if (point.name === 'left_knee') return { ...point, z: 0.06 };
      return point;
    });
    const behind = forward.map((point) => point.name === 'left_knee' ? { ...point, z: 0.14 } : point);

    expect(measurementsFor(forward, 'left').supportingKneeForwardDepthCue.value).toBeCloseTo(0.20, 5);
    expect(measurementsFor(behind, 'left').supportingKneeForwardDepthCue.value).toBeCloseTo(-0.20, 5);
    expect(measurementsFor(mirroredPerson(forward), 'right').supportingKneeForwardDepthCue.value)
      .toBeCloseTo(0.20, 5);
  });

  it('measures the working-knee depth cue with the same meaning after mirroring', () => {
    const landmarks = landmarkPerson().map((point) => {
      if (point.name === 'right_hip' || point.name === 'right_ankle') return { ...point, z: 0.10 };
      if (point.name === 'right_knee') return { ...point, z: 0.06 };
      return point;
    });

    expect(measurementsFor(landmarks, 'left').workingKneeForwardDepthCue.value).toBeCloseTo(0.20, 5);
    expect(measurementsFor(mirroredPerson(landmarks), 'right').workingKneeForwardDepthCue.value)
      .toBeCloseTo(0.20, 5);
  });

  it('interpolates knee depth in source pixels and normalises it on the z-compatible body-width scale', () => {
    const landmarks = landmarkPerson().map((point) => {
      if (point.name === 'left_hip') return { ...point, x: 0.40, y: 0.70, z: 0.20 };
      if (point.name === 'left_knee') return { ...point, x: 0.44, y: 0.82, z: 0.0423529412 };
      if (point.name === 'left_ankle') return { ...point, x: 0.50, y: 0.90, z: 0 };
      if (point.name === 'left_heel') return { ...point, x: 0.48, y: 0.91 };
      if (point.name === 'left_foot_index') return { ...point, x: 0.46, y: 0.89 };
      return point;
    });

    expect(measurementsFor(landmarks, 'left', 'front', 1000, 2000).supportingKneeForwardDepthCue.value)
      .toBeCloseTo(0.20, 5);
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
      1,
      1,
    );

    expect(measurements.supportingKneeAngle).toMatchObject({
      value: null,
      assessability: 'unassessable',
    });
  });

  it('withholds the supporting knee angle after cross-pass disagreement', () => {
    const landmarks = landmarkPerson();
    const measurements = measurePose(
      landmarks,
      'left',
      evaluateLandmarkReliability(landmarks, 'front', new Set(['left_knee'])),
      'front',
      1,
      1,
    );

    expect(measurements.supportingKneeAngle.value).toBeNull();
  });

  it('marks frontal-only support offset unassessable in a three-quarter view', () => {
    const landmarks = landmarkPerson();
    const measurements = measurePose(
      landmarks,
      'left',
      evaluateLandmarkReliability(landmarks, 'three-quarter-side'),
      'three-quarter-side',
      1,
      1,
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

  it('measures front-view foot extension, signed heel depth, side placement, floor height, and croise crossing bilaterally', () => {
    const landmarks = landmarkPerson().map((point) => {
      if (point.name === 'right_hip') return { ...point, x: 0.60, y: 0.70 };
      if (point.name === 'right_knee') return { ...point, x: 0.45, y: 0.78 };
      if (point.name === 'right_ankle') return { ...point, x: 0.30, y: 0.86 };
      if (point.name === 'right_heel') return { ...point, x: 0.24, y: 0.90, z: -0.04 };
      if (point.name === 'right_foot_index') return { ...point, x: 0.15, y: 0.94, z: 0.08 };
      return point;
    });
    const left = measurementsFor(landmarks, 'left', 'front');
    const right = measurementsFor(mirroredPerson(landmarks), 'right', 'front');

    expect(left.workingFootPointAngle.value).toBeCloseTo(180, 5);
    expect(left.workingHeelDepthCue.value).toBeCloseTo(0.60, 5);
    expect(left.workingAnkleOutwardOffset.value).toBeCloseTo(-0.75, 5);
    expect(left.workingFootHeightFromSupportingFoot.value).toBeCloseTo(0, 5);
    expect(left.croiseCrossingSeparation.value).toBeCloseTo(0.25, 5);
    for (const name of [
      'workingFootPointAngle',
      'workingHeelDepthCue',
      'workingAnkleOutwardOffset',
      'workingFootHeightFromSupportingFoot',
      'croiseCrossingSeparation',
    ] as const) {
      expect(right[name].value).toBeCloseTo(left[name].value!, 5);
    }
  });

  it('keeps the heel-depth cue stable when only the vertical torso length changes', () => {
    const landmarks = landmarkPerson().map((point) => {
      if (point.name === 'right_heel') return { ...point, z: -0.04 };
      if (point.name === 'right_foot_index') return { ...point, z: 0.08 };
      return point;
    });
    const tallerTorso = landmarks.map((point) => point.name === 'left_shoulder' || point.name === 'right_shoulder'
      ? { ...point, y: 0.20 }
      : point);

    expect(measurementsFor(landmarks).workingHeelDepthCue.value).toBeCloseTo(0.60, 5);
    expect(measurementsFor(tallerTorso).workingHeelDepthCue.value).toBeCloseTo(0.60, 5);
  });

  it('measures a visible working heel from the frontal heel-to-toe line after mirroring', () => {
    const landmarks = landmarkPerson().map((point) => {
      if (point.name === 'right_heel') return { ...point, x: 0.62 };
      if (point.name === 'right_foot_index') return { ...point, x: 0.68 };
      return point;
    });

    expect(measurementsFor(landmarks, 'left').workingHeelVisibilityCue.value).toBeCloseTo(0.30, 5);
    expect(measurementsFor(mirroredPerson(landmarks), 'right').workingHeelVisibilityCue.value).toBeCloseTo(0.30, 5);
  });

  it('withholds the heel-depth cue when either foot landmark has no finite depth', () => {
    const missingDepth = measurementsFor(landmarkPerson()).workingHeelDepthCue;
    const nonFiniteDepth = measurementsFor(landmarkPerson().map((point) => (
      point.name === 'right_heel' ? { ...point, z: Number.NaN }
        : point.name === 'right_foot_index' ? { ...point, z: 0.05 }
          : point
    ))).workingHeelDepthCue;

    expect(missingDepth).toMatchObject({ value: null, assessability: 'unassessable', reason: 'missing-geometry' });
    expect(nonFiniteDepth).toMatchObject({ value: null, assessability: 'unassessable' });
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

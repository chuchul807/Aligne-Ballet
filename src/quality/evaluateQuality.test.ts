import { describe, expect, it } from 'vitest';
import type { Landmark, LandmarkSet } from '../domain/types';
import { evaluateQuality, type QualityInput } from './evaluateQuality';
import { QUALITY_MESSAGES } from './messages';

const requiredNames = [
  'left_shoulder', 'right_shoulder', 'left_hip', 'right_hip',
  'left_knee', 'right_knee', 'left_ankle', 'right_ankle',
  'left_heel', 'right_heel', 'left_foot_index', 'right_foot_index',
] as const;

function landmark(name: Landmark['name'], x: number, y: number, visibility = 0.9): Landmark {
  return { name, x, y, visibility };
}

function fullPerson(overrides: readonly Landmark[] = []): readonly Landmark[] {
  const points: readonly Landmark[] = [
    landmark('left_shoulder', 0.375, 0.2), landmark('right_shoulder', 0.625, 0.2),
    landmark('left_hip', 0.4, 0.5), landmark('right_hip', 0.6, 0.5),
    landmark('left_knee', 0.35, 0.68), landmark('right_knee', 0.65, 0.68),
    landmark('left_ankle', 0.35, 0.82), landmark('right_ankle', 0.65, 0.82),
    landmark('left_heel', 0.33, 0.88), landmark('right_heel', 0.67, 0.88),
    landmark('left_foot_index', 0.31, 0.93), landmark('right_foot_index', 0.69, 0.93),
    landmark('left_elbow', 0.24, 0.36), landmark('right_elbow', 0.76, 0.36),
    landmark('left_wrist', 0.18, 0.45), landmark('right_wrist', 0.82, 0.45),
  ];
  return points.map((point) => overrides.find((item) => item.name === point.name) ?? point).concat(
    overrides.filter((item) => !points.some((point) => point.name === item.name)),
  );
}

function landmarkSet(people: ReadonlyArray<ReadonlyArray<Landmark>>): LandmarkSet {
  return { people, sourceWidth: 1000, sourceHeight: 1400 };
}

function baseInput(overrides: Partial<QualityInput> = {}): QualityInput {
  return {
    landmarks: landmarkSet([fullPerson()]),
    position: 'arabesque',
    supportingSide: 'left',
    expectedView: 'three-quarter-side',
    metrics: { meanLuminance: 0.5, contrast: 0.2, edgeEnergy: 0.1 },
    ...overrides,
  };
}

describe('evaluateQuality', () => {
  it.each([
    [landmarkSet([]), 'no-person'],
    [landmarkSet([fullPerson(), fullPerson()]), 'multiple-people'],
    [landmarkSet([fullPerson([landmark('left_foot_index', 0.01, 0.93)])]), 'body-out-of-frame'],
    [landmarkSet([fullPerson([landmark('left_knee', 0.35, 0.68, 0.59)])]), 'required-joints-not-visible'],
  ] as const)('fails with %s when a blocking quality condition is present', (landmarks, expected) => {
    const report = evaluateQuality(baseInput({ landmarks }));

    expect(report.status).toBe('fail');
    expect(report.reasons.map((reason) => reason.code)).toContain(expected);
  });

  it('returns an exact retake message for every blocking image condition', () => {
    const report = evaluateQuality(baseInput({
      metrics: { meanLuminance: 0.05, contrast: 0.01, edgeEnergy: 0.01 },
    }));

    expect(report.status).toBe('fail');
    expect(report.reasons).toEqual(expect.arrayContaining([
      { code: 'too-dark', message: 'Use brighter, even lighting and try again.' },
      { code: 'low-contrast', message: 'Use clearer lighting and fitted clothing that contrasts with the background.' },
      { code: 'blurred', message: 'Hold the camera steady and retake the photo.' },
    ]));
  });

  it('fails a three-quarter-side framing outside its broad camera-view range', () => {
    const narrowPerson = fullPerson([
      landmark('left_shoulder', 0.47, 0.2), landmark('right_shoulder', 0.53, 0.2),
      landmark('left_hip', 0.48, 0.5), landmark('right_hip', 0.52, 0.5),
    ]);

    const report = evaluateQuality(baseInput({ landmarks: landmarkSet([narrowPerson]) }));

    expect(report.status).toBe('fail');
    expect(report.reasons).toContainEqual({
      code: 'wrong-camera-view',
      message: 'Match the camera angle shown in the framing guide.',
    });
  });

  it('keeps leg and pelvis analysis available when optional arm joints are hidden', () => {
    const report = evaluateQuality(baseInput({
      landmarks: landmarkSet([fullPerson([
        landmark('left_elbow', 0.24, 0.36, 0.2), landmark('right_wrist', 0.82, 0.45, 0.2),
      ])]),
    }));

    expect(report).toEqual({
      status: 'partial',
      reasons: [],
      unassessableRegions: ['shoulders-arms'],
    });
  });

  it('passes a visible, well-lit full body in the prescribed broad view', () => {
    const report = evaluateQuality(baseInput());

    expect(report).toEqual({ status: 'pass', reasons: [], unassessableRegions: [] });
  });

  it('allows a high-key white background when the dancer still has clear contrast', () => {
    const report = evaluateQuality(baseInput({
      metrics: { meanLuminance: 0.9626, contrast: 0.1451, edgeEnergy: 0.2598 },
    }));

    expect(report.reasons.map((item) => item.code)).not.toContain('too-bright');
  });

  it('still rejects a washed-out image with high luminance and weak contrast', () => {
    const report = evaluateQuality(baseInput({
      metrics: { meanLuminance: 0.9626, contrast: 0.09, edgeEnergy: 0.1 },
    }));

    expect(report.reasons.map((item) => item.code)).toContain('too-bright');
  });

  it.each([
    ['luminance', { meanLuminance: 0.94, contrast: 0.09, edgeEnergy: 0.1 }, []],
    ['contrast', { meanLuminance: 0.9626, contrast: 0.10, edgeEnergy: 0.1 }, []],
  ] as const)('does not reject the exact %s boundary as too bright', (_boundary, metrics, expectedReasons) => {
    const report = evaluateQuality(baseInput({ metrics }));

    expect(report.reasons.map((item) => item.code)).toEqual(expectedReasons);
  });

  it('reports both overexposure and low contrast when both conditions are present', () => {
    const report = evaluateQuality(baseInput({
      metrics: { meanLuminance: 0.9626, contrast: 0.05, edgeEnergy: 0.1 },
    }));

    expect(report.reasons.map((item) => item.code)).toEqual(['too-bright', 'low-contrast']);
  });

  it.each([
    ['left', 'left_heel'],
    ['right', 'right_heel'],
  ] as const)('rejects tendu croise when the %s supporting heel is not visible', (supportingSide, heel) => {
    const report = evaluateQuality(baseInput({
      position: 'tendu-croise-devant',
      supportingSide,
      expectedView: 'front',
      landmarks: landmarkSet([fullPerson([landmark(heel, supportingSide === 'left' ? 0.33 : 0.67, 0.88, 0.59)])]),
    }));

    expect(report.reasons.map((reason) => reason.code)).toContain('required-joints-not-visible');
  });

  it('defers only required-joint visibility during the whole-image pass', () => {
    const report = evaluateQuality(baseInput({
      landmarks: landmarkSet([fullPerson([landmark('left_knee', 0.35, 0.68, 0.59)])]),
      requiredJointVisibility: 'defer',
    }));

    expect(report.reasons.map((reason) => reason.code)).not.toContain('required-joints-not-visible');
  });

  it('keeps required-joint rejection when camera-view validation is deferred', () => {
    const narrowPerson = fullPerson([
      landmark('left_shoulder', 0.49, 0.2), landmark('right_shoulder', 0.51, 0.2),
      landmark('left_hip', 0.49, 0.5), landmark('right_hip', 0.51, 0.5),
      landmark('left_knee', 0.35, 0.68, 0.59),
    ]);

    const report = evaluateQuality(baseInput({
      landmarks: landmarkSet([narrowPerson]),
      cameraViewCheck: 'defer',
    }));

    expect(report.reasons.map((reason) => reason.code)).toEqual(['required-joints-not-visible']);
  });

  it('still rejects out-of-frame evidence while visibility is deferred', () => {
    const report = evaluateQuality(baseInput({
      landmarks: landmarkSet([fullPerson([landmark('left_foot_index', 0.01, 0.93)])]),
      requiredJointVisibility: 'defer',
    }));

    expect(report.reasons.map((reason) => reason.code)).toContain('body-out-of-frame');
  });

  it('defines refined pose retake messages', () => {
    expect(QUALITY_MESSAGES['subject-too-small']).toBe(
      'Move closer while keeping your full body, hands, and feet in the frame.',
    );
    expect(QUALITY_MESSAGES['unstable-pose-landmarks']).toBe(
      'Retake the photo closer, with less clothing, barre, or limb overlap around the joints.',
    );
  });

  it('defines all required full-body landmark names in its test fixture', () => {
    expect(fullPerson().filter((point) => requiredNames.includes(point.name as (typeof requiredNames)[number]))).toHaveLength(12);
  });
});

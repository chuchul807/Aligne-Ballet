import { afterEach, describe, expect, it, vi } from 'vitest';
import { landmarkPerson } from '../../tests/builders/landmarks';
import type { LandmarkName } from '../domain/landmarks';
import type { LandmarkSet } from '../domain/types';
import type { QualityReport } from '../quality/types';
import { evaluateQuality } from '../quality/evaluateQuality';
import type { Observation } from '../domain/types';
import { evaluateLandmarkReliability } from '../reliability/evaluateLandmarkReliability';
import { measurePose } from '../analysis/measurePose';
import type { DecodedImage } from '../image/decodeImage';
import type { RefinePoseInput, RefinedPoseOutcome } from '../pose/refinePoseDetection';
import { analyzePose, type AnalysisRequest, type AnalysisServices } from './analyzePose';
import type { MeasurementSet } from '../domain/types';

const file = new File(['pose'], 'pose.jpg', { type: 'image/jpeg' });
const request: AnalysisRequest = {
  file,
  position: 'arabesque',
  supportingSide: 'left',
  expectedView: 'three-quarter-side',
};

const validLandmarks: LandmarkSet = {
  people: [landmarkPerson()], sourceWidth: 1000, sourceHeight: 1500,
};

function observation(id: string, region: Observation['region'], priority: Observation['priority'], severity: number): Observation {
  return { id, ruleId: id === 'head-missing' ? 'head-extreme-lateral-tilt' : 'supporting-knee-bent', dedupeKey: id, region, priority, confidence: 'high', evidence: [], annotation: [], assessability: 'assessable', issue: 'Visible issue.', action: 'Correct it.', direction: 'correct it', severity };
}

function decodedImage(): DecodedImage {
  const source = document.createElement('canvas');
  source.width = 1000;
  source.height = 1500;
  return {
    source,
    width: 1000,
    height: 1500,
    normalisation: { wasResized: false, originalWidth: 1000, originalHeight: 1500 },
    dispose: vi.fn(),
  };
}

function resizedDecodedImage(
  width: number,
  height: number,
  originalWidth: number,
  originalHeight: number,
): DecodedImage {
  const source = document.createElement('canvas');
  source.width = width;
  source.height = height;
  return {
    source,
    width,
    height,
    normalisation: { wasResized: true, originalWidth, originalHeight },
    dispose: vi.fn(),
  };
}

async function stableRefine({ whole }: RefinePoseInput): Promise<RefinedPoseOutcome> {
  return { status: 'success', landmarks: whole, disagreements: new Set() };
}

function servicesThatRecord(calls: string[], decoded: DecodedImage) {
  const landmarks = landmarkPerson();
  const wholeLandmarks = landmarks.map((point) => point.name === 'nose' ? { ...point, x: 0.48 } : point);
  const disagreements = new Set<LandmarkName>();
  const reliability = evaluateLandmarkReliability(landmarks, request.expectedView);
  const services = {
    detector: {
      detect: vi.fn<AnalysisServices['detector']['detect']>(async () => { calls.push('detect'); return { people: [wholeLandmarks], sourceWidth: decoded.width, sourceHeight: decoded.height }; }),
      close: vi.fn(),
    },
    decode: async () => decoded,
    metrics: vi.fn<NonNullable<AnalysisServices['metrics']>>(() => { calls.push('metrics'); return { meanLuminance: 0.5, contrast: 0.2, edgeEnergy: 0.1 }; }),
    quality: vi.fn<NonNullable<AnalysisServices['quality']>>(() => {
      calls.push('quality');
      return { status: 'pass', reasons: [], unassessableRegions: [] };
    }),
    refine: vi.fn<NonNullable<AnalysisServices['refine']>>(async () => {
      calls.push('refine');
      return {
        status: 'success',
        landmarks: { people: [landmarks], sourceWidth: decoded.width, sourceHeight: decoded.height },
        disagreements,
      };
    }),
    reliability: vi.fn<NonNullable<AnalysisServices['reliability']>>(() => { calls.push('reliability'); return reliability; }),
    measure: vi.fn<NonNullable<AnalysisServices['measure']>>(() => { calls.push('measure'); return measurePose(landmarks, 'left', reliability, request.expectedView, decoded.width, decoded.height); }),
    evaluate: vi.fn(() => { calls.push('evaluate'); return []; }),
    deduplicate: (items) => { calls.push('deduplicate'); return items; },
    feedback: () => { calls.push('feedback'); return { topCorrections: [], fullBodyReview: [] }; },
    annotations: vi.fn<NonNullable<AnalysisServices['annotations']>>(() => { calls.push('annotations'); return []; }),
  } satisfies AnalysisServices;
  return { services, landmarks, wholeLandmarks, reliability, disagreements };
}

function withoutMeasurements(
  measurements: MeasurementSet,
  names: readonly (keyof MeasurementSet)[],
): MeasurementSet {
  const unavailable = { ...measurements };
  for (const name of names) {
    unavailable[name] = {
      ...unavailable[name],
      value: null,
      assessability: 'unassessable',
      reason: 'missing-geometry',
    };
  }
  return unavailable;
}

describe('analyzePose', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('completes analysis when randomUUID is unavailable on an insecure HTTP origin', async () => {
    vi.stubGlobal('crypto', {
      getRandomValues: (bytes: Uint8Array) => {
        bytes.fill(7);
        return bytes;
      },
    });
    const calls: string[] = [];
    const decoded = decodedImage();
    const { services } = servicesThatRecord(calls, decoded);

    const outcome = await analyzePose(request, services);

    expect(outcome.status).toBe('success');
    if (outcome.status === 'success') {
      expect(outcome.result.sessionId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    }
  });

  it('returns camera-view diagnostics for a debug-mode rejection', async () => {
    const landmarks = landmarkPerson().map((point) => (
      point.name === 'left_shoulder'
      || point.name === 'right_shoulder'
      || point.name === 'left_hip'
      || point.name === 'right_hip'
        ? { ...point, x: 0.5 }
        : point
    ));
    const decoded = decodedImage();

    const outcome = await analyzePose({ ...request, debug: true } as AnalysisRequest & { debug: true }, {
      detector: {
        detect: vi.fn().mockResolvedValue({ people: [landmarks], sourceWidth: 1000, sourceHeight: 1500 }),
        close: vi.fn(),
      },
      decode: vi.fn().mockResolvedValue(decoded),
      metrics: vi.fn(() => ({ meanLuminance: 0.5, contrast: 0.2, edgeEnergy: 0.1 })),
    });

    expect(outcome).toMatchObject({
      status: 'retake',
      quality: { reasons: [{ code: 'wrong-camera-view' }] },
      diagnostics: {
        image: {
          width: 1000,
          height: 1500,
          originalWidth: 1000,
          originalHeight: 1500,
          metrics: { meanLuminance: 0.5, contrast: 0.2, edgeEnergy: 0.1 },
        },
        whole: {
          people: 1,
          cameraViewRatio: 0,
          landmarks: {
            left_shoulder: expect.objectContaining({ x: 0.5 }),
            right_shoulder: expect.objectContaining({ x: 0.5 }),
            left_hip: expect.objectContaining({ x: 0.5 }),
            right_hip: expect.objectContaining({ x: 0.5 }),
          },
        },
        initialQuality: { status: 'fail', reasons: ['wrong-camera-view'] },
      },
    });
  });

  it('passes one normalised source through metrics, detection, reliability, measurement, and annotations', async () => {
    const calls: string[] = [];
    const decoded = resizedDecodedImage(4096, 2048, 8000, 4000);
    const { services, landmarks, wholeLandmarks, reliability, disagreements } = servicesThatRecord(calls, decoded);
    const outcome = await analyzePose(request, services);

    expect(calls).toEqual(['metrics', 'detect', 'quality', 'refine', 'quality', 'reliability', 'measure', 'evaluate', 'deduplicate', 'feedback', 'annotations']);
    expect(services.metrics.mock.calls[0]?.[0]).toBe(decoded.source);
    expect(services.metrics.mock.calls[0]?.slice(1)).toEqual([4096, 2048]);
    expect(services.detector.detect.mock.calls[0]?.[0]).toBe(decoded.source);
    expect(services.detector.detect.mock.calls[0]?.slice(1)).toEqual([4096, 2048]);
    expect(services.quality.mock.calls[0]?.[0]).toMatchObject({
      landmarks: { sourceWidth: 4096, sourceHeight: 2048 },
      requiredJointVisibility: 'defer',
    });
    expect(services.quality.mock.calls[0]?.[0].landmarks.people[0]).toBe(wholeLandmarks);
    expect(services.quality.mock.calls[1]?.[0]).toMatchObject({
      landmarks: { sourceWidth: 4096, sourceHeight: 2048 },
      requiredJointVisibility: 'enforce',
    });
    expect(services.quality.mock.calls[1]?.[0].landmarks.people[0]).toBe(landmarks);
    expect(services.refine).toHaveBeenCalledWith({
      whole: expect.objectContaining({ sourceWidth: 4096, sourceHeight: 2048 }),
      source: decoded.source,
      width: 4096,
      height: 2048,
      detector: services.detector,
    });
    expect(services.reliability.mock.calls[0]?.[0]).toBe(landmarks);
    expect(services.reliability.mock.calls[0]?.[1]).toBe(request.expectedView);
    expect(services.reliability.mock.calls[0]?.[2]).toBe(disagreements);
    expect(services.measure.mock.calls[0]?.[0]).toBe(landmarks);
    expect(services.measure.mock.calls[0]?.[2]).toBe(reliability);
    expect(services.measure.mock.calls[0]?.[1]).toBe(request.supportingSide);
    expect(services.measure.mock.calls[0]?.[3]).toBe(request.expectedView);
    expect(services.measure.mock.calls[0]?.[4]).toBe(decoded.width);
    expect(services.measure.mock.calls[0]?.[5]).toBe(decoded.height);
    expect(services.annotations.mock.calls[0]?.[1]).toBe(landmarks);
    expect(services.annotations.mock.calls[0]?.[2]).toBe(reliability);
    expect(services.annotations.mock.calls[0]?.[3]).toBe(request.supportingSide);
    expect(outcome).toMatchObject({ status: 'success', quality: { imageWasResized: true } });
  });

  it.each([
    ['a-la-seconde', [
      'a-la-seconde-working-knee-bent',
      'a-la-seconde-working-leg-not-side',
      'a-la-seconde-foot-not-pointed',
      'a-la-seconde-turnout-not-visible',
      'a-la-seconde-pelvis-out-of-line',
    ]],
    ['tendu-croise-devant', [
      'tendu-working-knee-bent',
      'tendu-foot-not-pointed',
      'tendu-working-foot-lifted',
      'tendu-crossing-too-small',
    ]],
  ] as const)('routes %s through its front-view position rules', async (position, expectedRuleIds) => {
    const calls: string[] = [];
    const decoded = decodedImage();
    const { services } = servicesThatRecord(calls, decoded);
    services.measure.mockImplementation((landmarks, side, reliability, view, sourceWidth, sourceHeight) => (
      measurePose(landmarks, side, reliability, view, sourceWidth, sourceHeight)
    ));
    const evaluate = vi.fn<NonNullable<AnalysisServices['evaluate']>>((rules) => {
      const ruleIds = rules.map((rule) => rule.id);
      expect(ruleIds).toEqual(expect.arrayContaining([...expectedRuleIds]));
      expect(new Set(ruleIds).size).toBe(ruleIds.length);
      return [];
    });

    const outcome = await analyzePose(
      { ...request, position, expectedView: 'front' },
      { ...services, evaluate },
    );

    expect(outcome.status).toBe('success');
    expect(evaluate).toHaveBeenCalledOnce();
  });

  it('runs the quality gate before rules and links marked corrections to annotations', async () => {
    const evaluate = vi.fn(() => []);
    const outcome = await analyzePose(request, {
      detector: { detect: vi.fn().mockResolvedValue(validLandmarks), close: vi.fn() },
      decode: vi.fn().mockResolvedValue(decodedImage()),
      metrics: vi.fn(() => ({ meanLuminance: 0.5, contrast: 0.2, edgeEnergy: 0.1 })),
      quality: vi.fn((): QualityReport => ({ status: 'pass', reasons: [], unassessableRegions: [] })),
      refine: stableRefine,
      evaluate,
      now: () => '2026-09-03T12:00:00.000Z',
    });

    expect(outcome.status).toBe('success');
    expect(evaluate).toHaveBeenCalledOnce();
    if (outcome.status === 'success') {
      const marked = outcome.result.annotations.find((command) => 'observationId' in command);
      expect(outcome.result.topCorrections[0]?.observationId).toBe(marked?.observationId);
    }
  });

  it('returns retake reasons and never evaluates rules when quality fails', async () => {
    const evaluate = vi.fn(() => []);
    const decoded = decodedImage();
    const outcome = await analyzePose(request, {
      detector: { detect: vi.fn().mockResolvedValue({ ...validLandmarks, people: [] }), close: vi.fn() },
      decode: vi.fn().mockResolvedValue(decoded),
      metrics: vi.fn(() => ({ meanLuminance: 0.5, contrast: 0.2, edgeEnergy: 0.1 })),
      quality: vi.fn((): QualityReport => ({ status: 'fail', reasons: [{ code: 'no-person', message: 'No full body was detected. Step back and try again.' }], unassessableRegions: [] })),
      evaluate,
    });

    expect(outcome.status).toBe('retake');
    expect(evaluate).not.toHaveBeenCalled();
    expect(decoded.dispose).toHaveBeenCalledOnce();
  });

  it.each([
    ['subject-too-small', 'subject-too-small'],
    ['unstable-pose-landmarks', 'unstable-pose-landmarks'],
    ['insufficient-pose-evidence', 'insufficient-pose-evidence'],
  ] as const)('returns %s before rules', async (status, code) => {
    const calls: string[] = [];
    const decoded = decodedImage();
    const { services } = servicesThatRecord(calls, decoded);
    services.refine.mockResolvedValue({ status });

    const outcome = await analyzePose(request, services);

    expect(outcome).toMatchObject({ status: 'retake', quality: { reasons: [{ code }] } });
    expect(services.evaluate).not.toHaveBeenCalled();
    expect(decoded.dispose).toHaveBeenCalledOnce();
  });

  it('returns a refined-quality retake before rules and disposes the decoded image', async () => {
    const decoded = decodedImage();
    const evaluate = vi.fn(() => []);
    const quality = vi.fn()
      .mockReturnValueOnce({ status: 'pass', reasons: [], unassessableRegions: [] } satisfies QualityReport)
      .mockReturnValueOnce({
        status: 'fail',
        reasons: [{ code: 'required-joints-not-visible', message: 'Required joints are not visible.' }],
        unassessableRegions: [],
      } satisfies QualityReport);

    const outcome = await analyzePose(request, {
      detector: { detect: vi.fn().mockResolvedValue(validLandmarks), close: vi.fn() },
      decode: vi.fn().mockResolvedValue(decoded),
      metrics: vi.fn(() => ({ meanLuminance: 0.5, contrast: 0.2, edgeEnergy: 0.1 })),
      quality,
      refine: stableRefine,
      evaluate,
    });

    expect(outcome).toMatchObject({
      status: 'retake',
      quality: { reasons: [{ code: 'required-joints-not-visible' }] },
    });
    expect(evaluate).not.toHaveBeenCalled();
    expect(decoded.dispose).toHaveBeenCalledOnce();
  });

  it('uses the accepted whole-image camera view when refined landmarks drift across the threshold', async () => {
    const refinedPerson = landmarkPerson().map((point) => (
      point.name === 'left_shoulder'
      || point.name === 'right_shoulder'
      || point.name === 'left_hip'
      || point.name === 'right_hip'
        ? { ...point, x: point.name.startsWith('left_') ? 0.49 : 0.51 }
        : point
    ));
    const refinedLandmarks: LandmarkSet = {
      people: [refinedPerson], sourceWidth: 1000, sourceHeight: 1500,
    };

    const outcome = await analyzePose(request, {
      detector: { detect: vi.fn().mockResolvedValue(validLandmarks), close: vi.fn() },
      decode: vi.fn().mockResolvedValue(decodedImage()),
      metrics: vi.fn(() => ({ meanLuminance: 0.5, contrast: 0.2, edgeEnergy: 0.1 })),
      refine: vi.fn().mockResolvedValue({
        status: 'success',
        landmarks: refinedLandmarks,
        disagreements: new Set(),
      }),
    });

    expect(outcome.status).toBe('success');
  });

  it('keeps annotation labels in the exact composed Top 3 order', async () => {
    const observations = [
      observation('line-first', 'feet', 'line', 0.1),
      observation('structure-second', 'pelvis', 'structure', 0.2),
      observation('stability-third', 'supporting-leg', 'stability', 0.3),
    ];
    const annotations = vi.fn((items: readonly Observation[]) => {
      void items;
      return [];
    });
    const outcome = await analyzePose(request, {
      detector: { detect: vi.fn().mockResolvedValue(validLandmarks), close: vi.fn() },
      decode: vi.fn().mockResolvedValue(decodedImage()),
      metrics: vi.fn(() => ({ meanLuminance: 0.5, contrast: 0.2, edgeEnergy: 0.1 })),
      quality: vi.fn((): QualityReport => ({ status: 'pass', reasons: [], unassessableRegions: [] })),
      refine: stableRefine,
      evaluate: vi.fn(() => observations), annotations,
    });

    expect(outcome.status).toBe('success');
    expect(annotations.mock.calls[0]?.[0].map((item: Observation) => item.id)).toEqual(['stability-third', 'structure-second', 'line-first']);
    if (outcome.status === 'success') expect(outcome.result.topCorrections.map((item) => item.observationId)).toEqual(['stability-third', 'structure-second', 'line-first']);
  });

  it('marks rule-level uncertainty and low-confidence findings as unassessable', async () => {
    const unassessable: Observation = { id: 'head-missing', ruleId: 'head-extreme-lateral-tilt', dedupeKey: 'head-extreme-lateral-tilt', region: 'head', priority: 'line', confidence: 'low', evidence: [], annotation: [], assessability: 'unassessable', issue: null, action: null, direction: null, severity: null };
    const lowConfidence = { ...observation('low-pelvis', 'pelvis', 'structure', 0.7), confidence: 'low' as const };
    const outcome = await analyzePose(request, {
      detector: { detect: vi.fn().mockResolvedValue(validLandmarks), close: vi.fn() },
      decode: vi.fn().mockResolvedValue(decodedImage()),
      metrics: vi.fn(() => ({ meanLuminance: 0.5, contrast: 0.2, edgeEnergy: 0.1 })),
      quality: vi.fn((): QualityReport => ({ status: 'pass', reasons: [], unassessableRegions: [] })),
      refine: stableRefine,
      evaluate: vi.fn(() => [unassessable, lowConfidence]),
    });

    expect(outcome.status).toBe('success');
    if (outcome.status === 'success') {
      expect(outcome.quality).toMatchObject({
        status: 'partial',
        unassessableRegions: expect.arrayContaining(['head', 'pelvis']),
      });
      expect(outcome.result.fullBodyReview.find((section) => section.region === 'head')?.status).toBe('unassessable');
      expect(outcome.result.fullBodyReview.find((section) => section.region === 'pelvis')?.status).toBe('unassessable');
      expect(outcome.result.topCorrections).toEqual([]);
    }
  });

  it('keeps a region actionable when a high-confidence finding accompanies an unassessable rule', async () => {
    const highConfidence = observation('high-support', 'supporting-leg', 'stability', 0.7);
    const unassessable: Observation = {
      id: 'support-view-limited',
      ruleId: 'supporting-lateral-offset',
      dedupeKey: 'supporting-lateral-alignment',
      region: 'supporting-leg',
      priority: 'stability',
      confidence: 'low',
      evidence: [],
      annotation: [],
      assessability: 'unassessable',
      issue: null,
      action: null,
      direction: null,
      severity: null,
    };
    const outcome = await analyzePose(request, {
      detector: { detect: vi.fn().mockResolvedValue(validLandmarks), close: vi.fn() },
      decode: vi.fn().mockResolvedValue(decodedImage()),
      metrics: vi.fn(() => ({ meanLuminance: 0.5, contrast: 0.2, edgeEnergy: 0.1 })),
      quality: vi.fn((): QualityReport => ({ status: 'pass', reasons: [], unassessableRegions: [] })),
      refine: stableRefine,
      evaluate: vi.fn(() => [unassessable, highConfidence]),
    });

    expect(outcome.status).toBe('success');
    if (outcome.status === 'success') {
      expect(outcome.result.fullBodyReview.find((section) => section.region === 'supporting-leg'))
        .toMatchObject({ status: 'finding', items: [{ observationId: 'high-support' }] });
    }
  });

  it('continues when only an isolated arm chain is unreliable', async () => {
    const landmarks = landmarkPerson().map((point) => point.name === 'left_wrist'
      ? { ...point, x: 0.95, y: 0.5, visibility: 0.99 }
      : point);
    const outcome = await analyzePose(request, {
      detector: {
        detect: vi.fn().mockResolvedValue({ people: [landmarks], sourceWidth: 1000, sourceHeight: 1500 }),
        close: vi.fn(),
      },
      decode: vi.fn().mockResolvedValue(decodedImage()),
      metrics: vi.fn(() => ({ meanLuminance: 0.5, contrast: 0.2, edgeEnergy: 0.1 })),
      quality: vi.fn((): QualityReport => ({ status: 'partial', reasons: [], unassessableRegions: ['shoulders-arms'] })),
      refine: stableRefine,
    });

    expect(outcome.status).toBe('success');
  });

  it.each([
    ['supporting leg', request, ['supportingKneeAngle'], 'supporting-leg'],
    ['pelvis', request, ['pelvisSlope'], 'pelvis'],
    ['Retiré working leg', { ...request, position: 'retire-passe', expectedView: 'front' }, ['workingKneeLateralOffset'], 'working-leg'],
    ['Retiré feet', { ...request, position: 'retire-passe', expectedView: 'front' }, ['workingAnkleToSupportingKnee'], 'feet'],
  ] as const)('continues with a partial result when only the %s evidence requirement is missing', async (_label, localRequest, missing, region) => {
    const calls: string[] = [];
    const decoded = decodedImage();
    const { services, landmarks, reliability } = servicesThatRecord(calls, decoded);
    const measurements = measurePose(landmarks, localRequest.supportingSide, reliability, localRequest.expectedView, decoded.width, decoded.height);
    services.measure.mockReturnValue(withoutMeasurements(measurements, missing));

    const outcome = await analyzePose(localRequest, services);

    expect(outcome.status).toBe('success');
    if (outcome.status === 'success') {
      expect(outcome.quality).toMatchObject({
        status: 'partial',
        unassessableRegions: expect.arrayContaining([region]),
      });
    }
    expect(services.evaluate).toHaveBeenCalledOnce();
    expect(decoded.dispose).not.toHaveBeenCalled();
  });

  it('requests a retake before rules when the core evidence quorum is not met', async () => {
    const calls: string[] = [];
    const decoded = decodedImage();
    const { services, landmarks, reliability } = servicesThatRecord(calls, decoded);
    const measurements = measurePose(landmarks, request.supportingSide, reliability, request.expectedView, decoded.width, decoded.height);
    services.measure.mockReturnValue(withoutMeasurements(measurements, ['supportingKneeAngle', 'pelvisSlope']));

    const outcome = await analyzePose(request, services);

    expect(outcome).toMatchObject({
      status: 'retake',
      quality: {
        status: 'fail',
        reasons: [{ code: 'insufficient-pose-evidence' }],
        unassessableRegions: expect.arrayContaining(['supporting-leg', 'pelvis']),
      },
    });
    expect(services.evaluate).not.toHaveBeenCalled();
    expect(decoded.dispose).toHaveBeenCalledOnce();
  });

  it('returns unstable landmarks when viability fails with cross-pass disagreements', async () => {
    const calls: string[] = [];
    const decoded = resizedDecodedImage(4096, 2048, 8000, 4000);
    const { services, landmarks, reliability } = servicesThatRecord(calls, decoded);
    services.refine.mockResolvedValue({
      status: 'success',
      landmarks: { people: [landmarks], sourceWidth: decoded.width, sourceHeight: decoded.height },
      disagreements: new Set(['left_elbow']),
    });
    const measurements = measurePose(landmarks, request.supportingSide, reliability, request.expectedView, decoded.width, decoded.height);
    services.measure.mockReturnValue(withoutMeasurements(measurements, ['supportingKneeAngle', 'pelvisSlope']));

    const outcome = await analyzePose(request, services);

    expect(outcome).toMatchObject({
      status: 'retake',
      quality: {
        reasons: [{ code: 'unstable-pose-landmarks' }],
        imageWasResized: true,
        unassessableRegions: expect.arrayContaining(['supporting-leg', 'pelvis']),
      },
    });
    expect(services.evaluate).not.toHaveBeenCalled();
    expect(decoded.dispose).toHaveBeenCalledOnce();
  });

  it('suppresses knee and pelvis analysis when their landmarks disagree across passes', async () => {
    const decoded = decodedImage();
    const evaluate = vi.fn(() => []);
    const annotations = vi.fn(() => []);
    const outcome = await analyzePose(request, {
      detector: { detect: vi.fn().mockResolvedValue(validLandmarks), close: vi.fn() },
      decode: vi.fn().mockResolvedValue(decoded),
      metrics: vi.fn(() => ({ meanLuminance: 0.5, contrast: 0.2, edgeEnergy: 0.1 })),
      quality: vi.fn((): QualityReport => ({ status: 'pass', reasons: [], unassessableRegions: [] })),
      refine: async ({ whole }) => ({
        status: 'success',
        landmarks: whole,
        disagreements: new Set(['left_knee', 'right_hip']),
      }),
      evaluate,
      annotations,
    });

    expect(outcome).toMatchObject({
      status: 'retake',
      quality: {
        reasons: [{ code: 'unstable-pose-landmarks' }],
        unassessableRegions: expect.arrayContaining(['supporting-leg', 'pelvis']),
      },
    });
    expect(evaluate).not.toHaveBeenCalled();
    expect(annotations).not.toHaveBeenCalled();
    expect(decoded.dispose).toHaveBeenCalledOnce();
  });

  it('keeps an isolated arm disagreement as a partial successful analysis', async () => {
    const quality = vi.fn()
      .mockReturnValueOnce({ status: 'partial', reasons: [], unassessableRegions: ['shoulders-arms'] } satisfies QualityReport)
      .mockReturnValueOnce({ status: 'pass', reasons: [], unassessableRegions: [] } satisfies QualityReport);
    const outcome = await analyzePose(request, {
      detector: { detect: vi.fn().mockResolvedValue(validLandmarks), close: vi.fn() },
      decode: vi.fn().mockResolvedValue(decodedImage()),
      metrics: vi.fn(() => ({ meanLuminance: 0.5, contrast: 0.2, edgeEnergy: 0.1 })),
      quality,
      refine: async ({ whole }) => ({
        status: 'success',
        landmarks: whole,
        disagreements: new Set(['left_elbow']),
      }),
    });

    expect(outcome).toMatchObject({
      status: 'success',
      // The front-only supporting alignment rule is also unassessable in this view.
      quality: { status: 'partial', unassessableRegions: ['shoulders-arms', 'supporting-leg'] },
    });
    if (outcome.status === 'success') {
      expect(outcome.result.fullBodyReview.find((section) => section.region === 'shoulders-arms'))
        .toMatchObject({ status: 'unassessable' });
    }
  });

  it.each([
    ['nose', 'head'],
    ['left_eye_inner', 'head'], ['left_eye', 'head'], ['left_eye_outer', 'head'],
    ['right_eye_inner', 'head'], ['right_eye', 'head'], ['right_eye_outer', 'head'],
    ['left_ear', 'head'], ['right_ear', 'head'],
    ['mouth_left', 'head'], ['mouth_right', 'head'],
    ['left_shoulder', 'shoulders-arms'], ['right_shoulder', 'shoulders-arms'],
    ['left_elbow', 'shoulders-arms'], ['right_elbow', 'shoulders-arms'],
    ['left_wrist', 'shoulders-arms'], ['right_wrist', 'shoulders-arms'],
    ['left_pinky', 'shoulders-arms'], ['right_pinky', 'shoulders-arms'],
    ['left_index', 'shoulders-arms'], ['right_index', 'shoulders-arms'],
    ['left_thumb', 'shoulders-arms'], ['right_thumb', 'shoulders-arms'],
    ['left_hip', 'pelvis'], ['right_hip', 'pelvis'],
    ['left_knee', 'supporting-leg'], ['right_knee', 'working-leg'],
    ['left_ankle', 'feet'], ['right_ankle', 'feet'],
    ['left_heel', 'feet'], ['right_heel', 'feet'],
    ['left_foot_index', 'feet'], ['right_foot_index', 'feet'],
  ] as const)('suppresses the %s disagreement in %s despite passing both quality gates', async (name, region) => {
    const metrics = { meanLuminance: 0.5, contrast: 0.2, edgeEnergy: 0.1 };
    for (const requiredJointVisibility of ['defer', 'enforce'] as const) {
      expect(evaluateQuality({
        ...request, landmarks: validLandmarks, metrics, requiredJointVisibility,
      })).toEqual({ status: 'pass', reasons: [], unassessableRegions: [] });
    }
    const outcome = await analyzePose(request, {
      detector: { detect: async () => validLandmarks, close: () => {} },
      decode: async () => decodedImage(),
      metrics: () => metrics,
      refine: async ({ whole }) => ({
        status: 'success', landmarks: whole, disagreements: new Set([name]),
      }),
    });

    // Only these three points remove the existing core/position viability quorum.
    const needsRetake = name === 'left_hip' || name === 'right_hip' || name === 'right_ankle';
    expect(outcome.status).toBe(needsRetake ? 'retake' : 'success');
    if (outcome.status !== 'error') {
      expect(outcome.quality.unassessableRegions).toContain(region);
    }
    if (outcome.status === 'success') {
      expect(outcome.quality.status).toBe('partial');
      const section = outcome.result.fullBodyReview.find((section) => section.region === region);
      expect(section).toMatchObject({
        status: 'unassessable',
        items: [{ text: 'Unable to assess this area reliably because the joint may be obscured or inconsistent.' }],
      });
      expect(section?.items.some((item) => item.text.includes('No visible issue found'))).toBe(false);
      expect(outcome.result.topCorrections.some((item) => item.region === region)).toBe(false);
    }
  });

  it.each([
    ['left_knee', 'working-leg'],
    ['right_knee', 'supporting-leg'],
  ] as const)('maps %s disagreement with right-side support to %s', async (name, region) => {
    const outcome = await analyzePose({ ...request, supportingSide: 'right' }, {
      detector: { detect: async () => validLandmarks, close: () => {} },
      decode: async () => decodedImage(),
      metrics: () => ({ meanLuminance: 0.5, contrast: 0.2, edgeEnergy: 0.1 }),
      refine: async ({ whole }) => ({
        status: 'success', landmarks: whole, disagreements: new Set([name]),
      }),
    });

    expect(outcome).toMatchObject({
      status: 'success',
      quality: { status: 'partial', unassessableRegions: expect.arrayContaining([region]) },
    });
  });

  it('deduplicates initial, refined, and viability regional coverage', async () => {
    const calls: string[] = [];
    const decoded = decodedImage();
    const { services, landmarks, reliability } = servicesThatRecord(calls, decoded);
    services.quality.mockReturnValue({
      status: 'partial',
      reasons: [],
      unassessableRegions: ['pelvis'],
    });
    const measurements = measurePose(landmarks, request.supportingSide, reliability, request.expectedView, decoded.width, decoded.height);
    services.measure.mockReturnValue(withoutMeasurements(measurements, ['pelvisSlope']));

    const outcome = await analyzePose(request, services);

    expect(outcome).toMatchObject({
      status: 'success',
      quality: { status: 'partial', unassessableRegions: ['pelvis'] },
    });
  });

  it('preserves resize metadata when post-reliability evidence requires a retake', async () => {
    const calls: string[] = [];
    const decoded = resizedDecodedImage(4096, 2048, 8000, 4000);
    const { services, landmarks, reliability } = servicesThatRecord(calls, decoded);
    const measurements = measurePose(landmarks, request.supportingSide, reliability, request.expectedView, decoded.width, decoded.height);
    services.measure.mockReturnValue(withoutMeasurements(measurements, ['supportingKneeAngle', 'pelvisSlope']));

    const outcome = await analyzePose(request, services);

    expect(outcome).toMatchObject({
      status: 'retake',
      quality: { status: 'fail', imageWasResized: true },
    });
    expect(decoded.dispose).toHaveBeenCalledOnce();
  });

  it('requests a retake before rules when Retiré has no usable position-specific evidence', async () => {
    const calls: string[] = [];
    const decoded = decodedImage();
    const localRequest: AnalysisRequest = { ...request, position: 'retire-passe', expectedView: 'front' };
    const { services, landmarks, reliability } = servicesThatRecord(calls, decoded);
    const measurements = measurePose(landmarks, localRequest.supportingSide, reliability, localRequest.expectedView, decoded.width, decoded.height);
    services.measure.mockReturnValue(withoutMeasurements(
      measurements,
      ['workingKneeLateralOffset', 'workingAnkleToSupportingKnee'],
    ));

    const outcome = await analyzePose(localRequest, services);

    expect(outcome).toMatchObject({
      status: 'retake',
      quality: {
        status: 'fail',
        reasons: [{ code: 'insufficient-pose-evidence' }],
        unassessableRegions: expect.arrayContaining(['working-leg', 'feet']),
      },
    });
    expect(services.evaluate).not.toHaveBeenCalled();
    expect(decoded.dispose).toHaveBeenCalledOnce();
  });

  it('does not contradict combined arm coverage when one arm is occluded and the other is actionable', async () => {
    const landmarks = landmarkPerson().map((point) => point.name === 'left_wrist'
      ? { ...point, visibility: 0.2 }
      : point);
    const outcome = await analyzePose(request, {
      detector: {
        detect: vi.fn().mockResolvedValue({ people: [landmarks], sourceWidth: 1000, sourceHeight: 1500 }),
        close: vi.fn(),
      },
      decode: vi.fn().mockResolvedValue(decodedImage()),
      metrics: vi.fn(() => ({ meanLuminance: 0.5, contrast: 0.2, edgeEnergy: 0.1 })),
      refine: stableRefine,
      measure: (points, side, reliability, view, sourceWidth, sourceHeight) => {
        const measurements = measurePose(points, side, reliability, view, sourceWidth, sourceHeight);
        return {
          ...measurements,
          rightElbowAngle: {
            ...measurements.rightElbowAngle,
            value: 100,
            assessability: 'assessable',
            confidence: 'high',
          },
        };
      },
    });

    expect(outcome.status).toBe('success');
    if (outcome.status === 'success') {
      expect(outcome.result.topCorrections.some((item) => item.region === 'shoulders-arms')).toBe(false);
      expect(outcome.result.fullBodyReview.find((section) => section.region === 'shoulders-arms'))
        .toMatchObject({
          status: 'unassessable',
          items: [{
            text: 'Unable to assess this area reliably because the joint may be obscured or inconsistent.',
          }],
        });
    }
  });

  it('requests a retake when Arabesque position-critical working-leg evidence is unavailable', async () => {
    const landmarks = landmarkPerson().map((point) => point.name === 'right_ankle'
      ? { ...point, x: 0.95, y: 0.5, visibility: 0.99 }
      : point);
    const evaluate = vi.fn(() => []);
    const decoded = decodedImage();
    const outcome = await analyzePose(request, {
      detector: {
        detect: vi.fn().mockResolvedValue({ people: [landmarks], sourceWidth: 1000, sourceHeight: 1500 }),
        close: vi.fn(),
      },
      decode: vi.fn().mockResolvedValue(decoded),
      metrics: vi.fn(() => ({ meanLuminance: 0.5, contrast: 0.2, edgeEnergy: 0.1 })),
      quality: vi.fn((): QualityReport => ({ status: 'pass', reasons: [], unassessableRegions: [] })),
      refine: stableRefine,
      evaluate,
    });

    expect(outcome).toEqual({
      status: 'retake',
      quality: {
        status: 'fail',
        reasons: [{
          code: 'insufficient-pose-evidence',
          message: 'Retake the photo with your whole body clearly visible, including shoulders, hips, knees, ankles, and feet.',
        }],
        unassessableRegions: ['working-leg'],
        imageWasResized: false,
      },
    });
    expect(evaluate).not.toHaveBeenCalled();
    expect(decoded.dispose).toHaveBeenCalledOnce();
  });

  it.each([
    ['image-too-small', 'Image is too small. Choose a photo with a shortest side of at least 480 pixels.'],
    ['normalisation-failed', 'This photo could not be resized on this device. Try a smaller export or retake the photo.'],
    ['image-memory-failed', 'This photo could not be decoded with the memory available on this device. Try a smaller export or retake the photo.'],
    ['decode-failed', 'This photo could not be decoded on this device. Try a smaller export or retake the photo.'],
  ] as const)('returns an actionable retake report for %s decode failures', async (code, message) => {
    const outcome = await analyzePose(request, {
      detector: { detect: vi.fn(), close: vi.fn() },
      decode: vi.fn().mockRejectedValue({ code }),
    });

    expect(outcome).toEqual({ status: 'retake', quality: { status: 'fail', reasons: [{ code, message }], unassessableRegions: [] } });
  });
});

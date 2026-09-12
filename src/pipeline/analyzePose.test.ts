import { describe, expect, it, vi } from 'vitest';
import { landmarkPerson } from '../../tests/builders/landmarks';
import type { LandmarkSet } from '../domain/types';
import type { QualityReport } from '../quality/types';
import type { Observation } from '../domain/types';
import { evaluateLandmarkReliability } from '../reliability/evaluateLandmarkReliability';
import { measurePose } from '../analysis/measurePose';
import type { DecodedImage } from '../image/decodeImage';
import { analyzePose, type AnalysisRequest, type AnalysisServices } from './analyzePose';

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

function servicesThatRecord(calls: string[], decoded: DecodedImage) {
  const landmarks = landmarkPerson();
  const reliability = evaluateLandmarkReliability(landmarks, request.expectedView);
  const services = {
    detector: {
      detect: vi.fn<AnalysisServices['detector']['detect']>(async () => { calls.push('detect'); return { people: [landmarks], sourceWidth: decoded.width, sourceHeight: decoded.height }; }),
      close: vi.fn(),
    },
    decode: async () => decoded,
    metrics: vi.fn<NonNullable<AnalysisServices['metrics']>>(() => { calls.push('metrics'); return { meanLuminance: 0.5, contrast: 0.2, edgeEnergy: 0.1 }; }),
    quality: () => { calls.push('quality'); return { status: 'pass', reasons: [], unassessableRegions: [] }; },
    reliability: vi.fn<NonNullable<AnalysisServices['reliability']>>(() => { calls.push('reliability'); return reliability; }),
    measure: vi.fn<NonNullable<AnalysisServices['measure']>>(() => { calls.push('measure'); return measurePose(landmarks, 'left', reliability, request.expectedView); }),
    evaluate: () => { calls.push('evaluate'); return []; },
    deduplicate: (items) => { calls.push('deduplicate'); return items; },
    feedback: () => { calls.push('feedback'); return { topCorrections: [], fullBodyReview: [] }; },
    annotations: vi.fn<NonNullable<AnalysisServices['annotations']>>(() => { calls.push('annotations'); return []; }),
  } satisfies AnalysisServices;
  return { services, landmarks, reliability };
}

describe('analyzePose', () => {
  it('passes one normalised source through metrics, detection, reliability, measurement, and annotations', async () => {
    const calls: string[] = [];
    const decoded = resizedDecodedImage(4096, 2048, 8000, 4000);
    const { services, landmarks, reliability } = servicesThatRecord(calls, decoded);
    const outcome = await analyzePose(request, services);

    expect(calls).toEqual(['metrics', 'detect', 'quality', 'reliability', 'measure', 'evaluate', 'deduplicate', 'feedback', 'annotations']);
    expect(services.metrics.mock.calls[0]?.[0]).toBe(decoded.source);
    expect(services.metrics.mock.calls[0]?.slice(1)).toEqual([4096, 2048]);
    expect(services.detector.detect.mock.calls[0]?.[0]).toBe(decoded.source);
    expect(services.detector.detect.mock.calls[0]?.slice(1)).toEqual([4096, 2048]);
    expect(services.reliability.mock.calls[0]?.[0]).toBe(landmarks);
    expect(services.reliability.mock.calls[0]?.[1]).toBe(request.expectedView);
    expect(services.measure.mock.calls[0]?.[0]).toBe(landmarks);
    expect(services.measure.mock.calls[0]?.[2]).toBe(reliability);
    expect(services.measure.mock.calls[0]?.[1]).toBe(request.supportingSide);
    expect(services.measure.mock.calls[0]?.[3]).toBe(request.expectedView);
    expect(services.annotations.mock.calls[0]?.[1]).toBe(landmarks);
    expect(services.annotations.mock.calls[0]?.[2]).toBe(reliability);
    expect(services.annotations.mock.calls[0]?.[3]).toBe(request.supportingSide);
    expect(outcome).toMatchObject({ status: 'success', quality: { imageWasResized: true } });
  });

  it('runs the quality gate before rules and links marked corrections to annotations', async () => {
    const evaluate = vi.fn(() => []);
    const outcome = await analyzePose(request, {
      detector: { detect: vi.fn().mockResolvedValue(validLandmarks), close: vi.fn() },
      decode: vi.fn().mockResolvedValue(decodedImage()),
      metrics: vi.fn(() => ({ meanLuminance: 0.5, contrast: 0.2, edgeEnergy: 0.1 })),
      quality: vi.fn((): QualityReport => ({ status: 'pass', reasons: [], unassessableRegions: [] })),
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
    const outcome = await analyzePose(request, {
      detector: { detect: vi.fn().mockResolvedValue({ ...validLandmarks, people: [] }), close: vi.fn() },
      decode: vi.fn().mockResolvedValue(decodedImage()),
      metrics: vi.fn(() => ({ meanLuminance: 0.5, contrast: 0.2, edgeEnergy: 0.1 })),
      quality: vi.fn((): QualityReport => ({ status: 'fail', reasons: [{ code: 'no-person', message: 'No full body was detected. Step back and try again.' }], unassessableRegions: [] })),
      evaluate,
    });

    expect(outcome.status).toBe('retake');
    expect(evaluate).not.toHaveBeenCalled();
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
      evaluate: vi.fn(() => [unassessable, lowConfidence]),
    });

    expect(outcome.status).toBe('success');
    if (outcome.status === 'success') {
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
    });

    expect(outcome.status).toBe('success');
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
      measure: (points, side, reliability, view) => {
        const measurements = measurePose(points, side, reliability, view);
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
        .toMatchObject({ status: 'unassessable', items: [{ text: 'Unable to assess this area from the current image.' }] });
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
      },
    });
    expect(evaluate).not.toHaveBeenCalled();
    expect(decoded.dispose).toHaveBeenCalledOnce();
  });

  it.each([
    ['image-too-small', 'Image is too small. Choose a photo with a shortest side of at least 480 pixels.'],
    ['normalisation-failed', 'This photo could not be resized on this device. Try a smaller export or retake the photo.'],
    ['image-memory-failed', 'This photo could not be decoded with the memory available on this device. Try a smaller export or retake the photo.'],
  ] as const)('returns an actionable retake report for %s decode failures', async (code, message) => {
    const outcome = await analyzePose(request, {
      detector: { detect: vi.fn(), close: vi.fn() },
      decode: vi.fn().mockRejectedValue({ code }),
    });

    expect(outcome).toEqual({ status: 'retake', quality: { status: 'fail', reasons: [{ code, message }], unassessableRegions: [] } });
  });
});

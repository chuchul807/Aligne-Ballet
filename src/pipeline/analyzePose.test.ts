import { describe, expect, it, vi } from 'vitest';
import { landmarkPerson } from '../../tests/builders/landmarks';
import type { LandmarkSet } from '../domain/types';
import type { QualityReport } from '../quality/types';
import type { Observation } from '../domain/types';
import { analyzePose, type AnalysisRequest } from './analyzePose';

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
  return { id, ruleId: id === 'head-missing' ? 'head-extreme-lateral-tilt' : 'supporting-knee-bent', region, priority, confidence: 'high', evidence: [], annotation: [], assessability: 'assessable', issue: 'Visible issue.', action: 'Correct it.', direction: 'correct it', severity };
}

describe('analyzePose', () => {
  it('runs the quality gate before rules and links marked corrections to annotations', async () => {
    const evaluate = vi.fn(() => []);
    const outcome = await analyzePose(request, {
      detector: { detect: vi.fn().mockResolvedValue(validLandmarks), close: vi.fn() },
      decode: vi.fn().mockResolvedValue({ source: document.createElement('canvas'), width: 1000, height: 1500, dispose: vi.fn() }),
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
    const evaluate = vi.fn();
    const outcome = await analyzePose(request, {
      detector: { detect: vi.fn().mockResolvedValue({ ...validLandmarks, people: [] }), close: vi.fn() },
      decode: vi.fn().mockResolvedValue({ source: document.createElement('canvas'), width: 1000, height: 1500, dispose: vi.fn() }),
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
      decode: vi.fn().mockResolvedValue({ source: document.createElement('canvas'), width: 1000, height: 1500, dispose: vi.fn() }),
      metrics: vi.fn(() => ({ meanLuminance: 0.5, contrast: 0.2, edgeEnergy: 0.1 })),
      quality: vi.fn((): QualityReport => ({ status: 'pass', reasons: [], unassessableRegions: [] })),
      evaluate: vi.fn(() => observations), annotations,
    });

    expect(outcome.status).toBe('success');
    expect(annotations.mock.calls[0]?.[0].map((item: Observation) => item.id)).toEqual(['stability-third', 'structure-second', 'line-first']);
    if (outcome.status === 'success') expect(outcome.result.topCorrections.map((item) => item.observationId)).toEqual(['stability-third', 'structure-second', 'line-first']);
  });

  it('marks a rule-level unassessable region as unable to assess without treating a low-confidence finding as unassessable', async () => {
    const unassessable: Observation = { id: 'head-missing', ruleId: 'head-extreme-lateral-tilt', region: 'head', priority: 'line', confidence: 'low', evidence: [], annotation: [], assessability: 'unassessable', issue: null, action: null, direction: null, severity: null };
    const lowConfidence = { ...observation('low-pelvis', 'pelvis', 'structure', 0.7), confidence: 'low' as const };
    const outcome = await analyzePose(request, {
      detector: { detect: vi.fn().mockResolvedValue(validLandmarks), close: vi.fn() },
      decode: vi.fn().mockResolvedValue({ source: document.createElement('canvas'), width: 1000, height: 1500, dispose: vi.fn() }),
      metrics: vi.fn(() => ({ meanLuminance: 0.5, contrast: 0.2, edgeEnergy: 0.1 })),
      quality: vi.fn((): QualityReport => ({ status: 'pass', reasons: [], unassessableRegions: [] })),
      evaluate: vi.fn(() => [unassessable, lowConfidence]),
    });

    expect(outcome.status).toBe('success');
    if (outcome.status === 'success') {
      expect(outcome.result.fullBodyReview.find((section) => section.region === 'head')?.status).toBe('unassessable');
      expect(outcome.result.fullBodyReview.find((section) => section.region === 'pelvis')?.status).toBe('clear');
      expect(outcome.result.topCorrections).toEqual([]);
    }
  });

  it.each([
    ['image-too-small', 'Image is too small. Choose a photo with a shortest side of at least 480 pixels.'],
    ['image-too-large', 'Image is too large. Choose a photo with a longest side of 8192 pixels or smaller.'],
  ] as const)('returns an actionable retake report for %s decode failures', async (code, message) => {
    const outcome = await analyzePose(request, {
      detector: { detect: vi.fn(), close: vi.fn() },
      decode: vi.fn().mockRejectedValue({ code }),
    });

    expect(outcome).toEqual({ status: 'retake', quality: { status: 'fail', reasons: [{ code, message }], unassessableRegions: [] } });
  });
});

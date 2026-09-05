import { describe, expect, it, vi } from 'vitest';
import { landmarkPerson } from '../../tests/builders/landmarks';
import type { LandmarkSet } from '../domain/types';
import type { QualityReport } from '../quality/types';
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
});

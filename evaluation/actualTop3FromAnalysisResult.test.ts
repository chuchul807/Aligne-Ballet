import { describe, expect, it } from 'vitest';
import type { AnalysisResult } from '../src/domain/types';
import { actualTop3FromAnalysisResult } from './actualTop3FromAnalysisResult';

describe('actualTop3FromAnalysisResult', () => {
  it('maps structured directions retained from composed feedback instead of display prose', () => {
    const result: AnalysisResult = {
      sessionId: 'session',
      position: 'arabesque',
      landmarks: [],
      topCorrections: [
        { observationId: 'one', ruleId: 'supporting-knee-bent', text: 'Display wording may change.', region: 'supporting-leg', direction: 'straighten-supporting-knee', priority: 'stability', confidence: 'high' },
        { observationId: 'two', ruleId: 'pelvis-unlevel', text: 'Another display phrase.', region: 'pelvis', direction: 'level-pelvis', priority: 'structure', confidence: 'medium' },
      ],
      fullBodyReview: [],
      annotations: [],
      createdAt: '2026-09-03T12:00:00.000Z',
    };

    expect(actualTop3FromAnalysisResult(result)).toEqual([
      { region: 'supporting-leg', direction: 'straighten-supporting-knee' },
      { region: 'pelvis', direction: 'level-pelvis' },
    ]);
  });
});

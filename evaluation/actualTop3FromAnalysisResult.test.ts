import { describe, expect, it } from 'vitest';
import type { AnalysisResult } from '../src/domain/types';
import { composeFeedback, type AssessmentCoverage } from '../src/feedback/composeFeedback';
import { actualTop3FromAnalysisResult } from './actualTop3FromAnalysisResult';

describe('actualTop3FromAnalysisResult', () => {
  it('maps the rule-owned code from real composed feedback instead of natural-language direction prose', () => {
    const coverage: AssessmentCoverage = {
      'supporting-leg': 'assessable', 'working-leg': 'assessable', pelvis: 'assessable', torso: 'assessable',
      'shoulders-arms': 'assessable', head: 'assessable', feet: 'assessable',
    };
    const summary = composeFeedback([{
      id: 'one', ruleId: 'supporting-knee-bent', dedupeKey: 'supporting-knee-bent', region: 'supporting-leg', priority: 'stability', confidence: 'high',
      evidence: [], annotation: [], assessability: 'assessable', issue: 'Visible bend.', action: 'Straighten it.',
      direction: 'lengthen the supporting leg', severity: 0.4,
    }], coverage);
    const result: AnalysisResult = {
      sessionId: 'session',
      position: 'arabesque',
      landmarks: [],
      ...summary,
      annotations: [],
      createdAt: '2026-09-03T12:00:00.000Z',
    };

    expect(actualTop3FromAnalysisResult(result)).toEqual([
      { region: 'supporting-leg', direction: 'straighten-supporting-knee' },
    ]);
  });

  it('rejects an unknown rule ID instead of inventing a direction code', () => {
    const result = { sessionId: 'session', position: 'arabesque', landmarks: [], topCorrections: [{ observationId: 'one', ruleId: 'unknown-rule', text: 'Text.', region: 'pelvis', direction: 'natural prose', priority: 'structure', confidence: 'high' }], fullBodyReview: [], annotations: [], createdAt: '2026-09-03T12:00:00.000Z' } as AnalysisResult;

    expect(() => actualTop3FromAnalysisResult(result)).toThrow(/unknown-rule/);
  });
});

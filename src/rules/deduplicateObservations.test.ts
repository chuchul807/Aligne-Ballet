import { describe, expect, it } from 'vitest';
import type { Observation } from '../domain/types';
import { deduplicateObservations } from './deduplicateObservations';

function finding(
  overrides: Partial<Extract<Observation, { assessability: 'assessable' }>>,
): Observation {
  return {
    id: 'finding', ruleId: 'pelvis-unlevel', dedupeKey: 'pelvis-level', region: 'pelvis',
    priority: 'structure', confidence: 'high', evidence: ['left_hip', 'right_hip'], annotation: [],
    assessability: 'assessable', issue: 'Visible issue.', action: 'Correct it.',
    direction: 'level the visible pelvis line', severity: 0.5, ...overrides,
  };
}

describe('deduplicateObservations', () => {
  it('keeps one deterministic correction for observations sharing a dedupe key', () => {
    const result = deduplicateObservations([
      finding({ id: 'position', ruleId: 'position', priority: 'structure', severity: 0.4 }),
      finding({ id: 'common', ruleId: 'common', priority: 'structure', severity: 0.8 }),
    ]);
    expect(result.map((item) => item.id)).toEqual(['common']);
  });

  it('prefers assessability, confidence, priority, severity, then lexical rule ID', () => {
    const lowPriority = finding({ id: 'line', ruleId: 'z-line', priority: 'line', severity: 1 });
    const structural = finding({ id: 'structure', ruleId: 'a-structure', priority: 'structure', severity: 0.1 });
    const highSeverity = finding({ id: 'severity', ruleId: 'z-severity', priority: 'structure', severity: 0.9 });
    const lexical = finding({ id: 'lexical', ruleId: 'a-lexical', priority: 'structure', severity: 0.9 });
    const medium = finding({ id: 'medium', ruleId: 'medium', confidence: 'medium', priority: 'stability', severity: 1 });
    const unassessable: Observation = {
      ...finding({ id: 'unassessable', ruleId: 'unassessable', priority: 'stability', severity: 1 }),
      assessability: 'unassessable', confidence: 'low', issue: null, action: null, direction: null, severity: null,
    };

    expect(deduplicateObservations([
      unassessable, medium, lowPriority, structural, highSeverity, lexical,
    ]).map((item) => item.id)).toEqual(['lexical']);
  });

  it('preserves the winning observations in their original relative order', () => {
    const result = deduplicateObservations([
      finding({ id: 'first', ruleId: 'first', dedupeKey: 'first-key' }),
      finding({ id: 'loser', ruleId: 'loser', dedupeKey: 'shared', severity: 0.1 }),
      finding({ id: 'second', ruleId: 'second', dedupeKey: 'second-key' }),
      finding({ id: 'winner', ruleId: 'winner', dedupeKey: 'shared', severity: 0.9 }),
    ]);

    expect(result.map((item) => item.id)).toEqual(['first', 'second', 'winner']);
  });

  it('uses lexical rule ID to break equal null-severity ties regardless of input order', () => {
    const a: Observation = {
      ...finding({ id: 'a', ruleId: 'a' }),
      assessability: 'unassessable', confidence: 'low', issue: null, action: null,
      direction: null, severity: null,
    };
    const z: Observation = {
      ...finding({ id: 'z', ruleId: 'z' }),
      assessability: 'unassessable', confidence: 'low', issue: null, action: null,
      direction: null, severity: null,
    };

    expect(deduplicateObservations([z, a]).map((item) => item.id)).toEqual(['a']);
    expect(deduplicateObservations([a, z]).map((item) => item.id)).toEqual(['a']);
  });
});

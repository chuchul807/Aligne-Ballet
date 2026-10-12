import { describe, expect, it } from 'vitest';
import { createAnalysisSession } from './types';
import type { Landmark, ReliabilityReason } from './types';

describe('Landmark', () => {
  it('retains optional presence confidence', () => {
    const landmark: Landmark = {
      name: 'left_knee', x: 0.4, y: 0.6, z: -0.1, visibility: 0.9, presence: 0.85,
    };

    expect(landmark.presence).toBe(0.85);
  });
});

describe('ReliabilityReason', () => {
  it('includes presence and cross-pass disagreement reasons', () => {
    const reasons: readonly ReliabilityReason[] = ['low-presence', 'cross-pass-disagreement'];

    expect(reasons).toEqual(['low-presence', 'cross-pass-disagreement']);
  });
});

describe('createAnalysisSession', () => {
  it('creates one image frame slot without coupling the session to one frame', () => {
    const session = createAnalysisSession('arabesque', 'left', 'three-quarter-side', '2026-09-03T12:00:00.000Z');

    expect(session).toMatchObject({
      position: 'arabesque',
      supportingSide: 'left',
      expectedViews: ['three-quarter-side'],
      frames: [],
      status: 'select',
    });
  });
});

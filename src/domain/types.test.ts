import { describe, expect, it } from 'vitest';
import { createAnalysisSession } from './types';

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

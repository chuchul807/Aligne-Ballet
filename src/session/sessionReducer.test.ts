import { describe, expect, it } from 'vitest';
import { initialSessionState, sessionReducer } from './sessionReducer';
import type { SessionState } from './sessionReducer';

describe('sessionReducer', () => {
  it('does not open Result before analysis succeeds', () => {
    const selected = sessionReducer(initialSessionState, {
      type: 'selection-confirmed',
      position: 'arabesque',
      supportingSide: 'left',
    });

    expect(sessionReducer(selected, { type: 'stage-requested', stage: 'result' }).stage).toBe('frame');
  });

  it('invalidates an existing result when the selected position changes', () => {
    const stateWithResult = {
      ...initialSessionState,
      stage: 'result',
      unlockedStages: new Set(['select', 'frame', 'check', 'result']),
      position: 'arabesque',
      supportingSide: 'left',
      result: { sessionId: 'session-1', position: 'arabesque', landmarks: [], topCorrections: [], fullBodyReview: [], annotations: [], createdAt: '2026-09-03T12:00:00.000Z' },
    } satisfies SessionState;

    const changed = sessionReducer(stateWithResult, {
      type: 'position-changed',
      position: 'retire-passe',
    });

    expect(changed.result).toBeNull();
    expect(changed.stage).toBe('select');
  });

  it('invalidates an existing result when the supporting side changes', () => {
    const stateWithResult = {
      ...initialSessionState,
      stage: 'result',
      unlockedStages: new Set(['select', 'frame', 'check', 'result']),
      position: 'arabesque',
      supportingSide: 'left',
      result: { sessionId: 'session-1', position: 'arabesque', landmarks: [], topCorrections: [], fullBodyReview: [], annotations: [], createdAt: '2026-09-03T12:00:00.000Z' },
    } satisfies SessionState;

    const changed = sessionReducer(stateWithResult, {
      type: 'supporting-side-changed',
      supportingSide: 'right',
    });

    expect(changed.result).toBeNull();
    expect(changed.stage).toBe('select');
    expect(changed.unlockedStages.has('result')).toBe(false);
  });
});

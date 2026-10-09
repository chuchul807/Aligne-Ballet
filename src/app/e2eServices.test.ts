import { describe, expect, it } from 'vitest';
import { selectE2EServices } from './e2eServices';

describe('selectE2EServices', () => {
  it('uses injected services only in the explicit e2e Vite mode', () => {
    const injected = { createDetector: async () => ({ detect: async () => ({ people: [], sourceWidth: 0, sourceHeight: 0 }), close: () => {} }), now: () => 'now' };

    expect(selectE2EServices('e2e', injected)).toBe(injected);
    expect(selectE2EServices('production', injected)).toBeUndefined();
  });
});

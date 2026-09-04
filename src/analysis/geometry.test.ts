import { describe, expect, it } from 'vitest';
import { angleDeg, normalisedDistance, slopeDeg } from './geometry';

describe('geometry', () => {
  it('returns 180 degrees for a straight knee', () => {
    expect(angleDeg({ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 })).toBeCloseTo(180, 5);
  });

  it('normalises distance by torso length', () => {
    expect(normalisedDistance({ x: 0, y: 0 }, { x: 0.5, y: 0 }, 0.25)).toBeCloseTo(2, 5);
  });

  it('returns null for degenerate vectors instead of NaN', () => {
    expect(angleDeg({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeNull();
    expect(normalisedDistance({ x: 0, y: 0 }, { x: 1, y: 0 }, 0)).toBeNull();
  });

  it('measures a horizontal slope', () => {
    expect(slopeDeg({ x: 0, y: 2 }, { x: 1, y: 2 })).toBeCloseTo(0, 5);
  });
});

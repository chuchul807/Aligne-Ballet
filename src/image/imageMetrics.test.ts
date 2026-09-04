import { describe, expect, it } from 'vitest';
import { calculateImageMetrics } from './imageMetrics';

describe('calculateImageMetrics', () => {
  it('normalises luminance, contrast, and adjacent-pixel gradients from decoded pixels', () => {
    const metrics = calculateImageMetrics({
      width: 2,
      height: 2,
      data: new Uint8ClampedArray([
        0, 0, 0, 255, 255, 255, 255, 255,
        0, 0, 0, 255, 255, 255, 255, 255,
      ]),
    });

    expect(metrics.meanLuminance).toBeCloseTo(0.5, 5);
    expect(metrics.contrast).toBeCloseTo(0.5, 5);
    expect(metrics.edgeEnergy).toBeCloseTo(0.5, 5);
  });

  it('has no artificial sharpness for a uniform decoded image', () => {
    const metrics = calculateImageMetrics({
      width: 2,
      height: 2,
      data: new Uint8ClampedArray(Array.from({ length: 16 }, (_, index) => index % 4 === 3 ? 255 : 128)),
    });

    expect(metrics).toMatchObject({ contrast: 0, edgeEnergy: 0 });
  });
});

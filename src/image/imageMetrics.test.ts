import { describe, expect, it } from 'vitest';
import { calculateImageMetrics } from './imageMetrics';

function grayscalePixels(width: number, height: number, luminanceAt: (x: number, y: number) => number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const channel = Math.round(luminanceAt(x, y) * 255);
      data[offset] = channel;
      data[offset + 1] = channel;
      data[offset + 2] = channel;
      data[offset + 3] = 255;
    }
  }
  return data;
}

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

  it.each([
    [100, 100],
    [192, 256],
    [256, 256],
  ])('keeps a sparse, crisp subject sharp at a %d by %d sampling size', (width, height) => {
    const metrics = calculateImageMetrics({
      width,
      height,
      data: grayscalePixels(width, height, (x, y) => (
        x >= Math.floor(width * 0.4) && x < Math.ceil(width * 0.6)
          && y >= Math.floor(height * 0.2) && y < Math.ceil(height * 0.8)
          ? 0.4
          : 1
      )),
    });

    expect(metrics.edgeEnergy).toBeGreaterThanOrEqual(0.08);
  });

  it('keeps a genuinely soft subject below the sharpness threshold', () => {
    const width = 100;
    const height = 100;
    const metrics = calculateImageMetrics({
      width,
      height,
      data: grayscalePixels(width, height, (x, y) => {
        const dx = Math.max(40 - x, 0, x - 59);
        const dy = Math.max(20 - y, 0, y - 79);
        const distance = Math.hypot(dx, dy);
        const darkness = 0.6 * Math.max(0, 1 - distance / 18);
        return 1 - darkness;
      }),
    });

    expect(metrics.edgeEnergy).toBeLessThan(0.08);
  });
});

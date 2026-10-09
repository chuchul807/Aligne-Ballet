import { describe, expect, it, vi } from 'vitest';
import { normaliseImage } from './normaliseImage';

describe('normaliseImage', () => {
  it('resizes an 8000×4000 bitmap to 4096×2048 and preserves metadata', () => {
    const drawImage = vi.fn();
    const canvas = { width: 0, height: 0, getContext: () => ({ drawImage }) } as unknown as HTMLCanvasElement;
    const release = vi.fn();

    const result = normaliseImage(
      { width: 8000, height: 4000 } as ImageBitmap,
      release,
      () => canvas,
    );

    expect(result).toMatchObject({
      source: canvas,
      width: 4096,
      height: 2048,
      normalisation: { wasResized: true, originalWidth: 8000, originalHeight: 4000 },
    });
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 4096, 2048);
  });

  it('rejects a shortest side below 480 without creating a canvas', () => {
    let failure: unknown;
    try {
      normaliseImage({ width: 479, height: 960 } as ImageBitmap, vi.fn(), vi.fn());
    } catch (error) {
      failure = error;
    }
    expect(failure).toEqual({ code: 'image-too-small' });
  });

  it('returns an actionable code when the resize canvas is unavailable', () => {
    let failure: unknown;
    try {
      normaliseImage(
        { width: 9000, height: 6000 } as ImageBitmap,
        vi.fn(),
        () => ({ getContext: () => null } as unknown as HTMLCanvasElement),
      );
    } catch (error) {
      failure = error;
    }
    expect(failure).toEqual({ code: 'normalisation-failed' });
  });
});

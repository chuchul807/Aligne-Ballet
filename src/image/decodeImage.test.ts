import { afterEach, describe, expect, it, vi } from 'vitest';
import { decodeImage } from './decodeImage';

describe('decodeImage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns a bitmap and releases it through dispose', async () => {
    const close = vi.fn();
    const bitmap = { width: 640, height: 960, close } as unknown as ImageBitmap;
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(bitmap));

    const decoded = await decodeImage(new File(['x'], 'pose.jpg', { type: 'image/jpeg' }));
    decoded.dispose();

    expect(decoded).toMatchObject({ source: bitmap, width: 640, height: 960 });
    expect(close).toHaveBeenCalledOnce();
  });

  it('rejects a bitmap whose shortest side is below 480 pixels', async () => {
    const bitmap = { width: 479, height: 960, close: vi.fn() } as unknown as ImageBitmap;
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(bitmap));

    await expect(decodeImage(new File(['x'], 'pose.jpg', { type: 'image/jpeg' }))).rejects.toEqual({
      code: 'image-too-small',
    });
  });

  it('rejects a bitmap with a side above 8192 pixels', async () => {
    const bitmap = { width: 8193, height: 960, close: vi.fn() } as unknown as ImageBitmap;
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(bitmap));

    await expect(decodeImage(new File(['x'], 'pose.jpg', { type: 'image/jpeg' }))).rejects.toEqual({
      code: 'image-too-large',
    });
  });

  it('falls back to an image element when bitmap decoding rejects with a DOMException code', async () => {
    class FallbackImage {
      naturalWidth = 640;
      naturalHeight = 960;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;

      set src(value: string) {
        if (value) queueMicrotask(() => this.onload?.());
      }
    }

    const bitmapFailure = new DOMException('Cannot decode this image', 'EncodingError');
    expect(bitmapFailure.code).toEqual(expect.any(Number));
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(bitmapFailure));
    vi.stubGlobal('Image', FallbackImage);
    const createUrl = vi.spyOn(URL, 'createObjectURL');

    const decoded = await decodeImage(new File(['x'], 'pose.jpg', { type: 'image/jpeg' }));

    expect(createUrl).toHaveBeenCalledOnce();
    expect(decoded.source).toBeInstanceOf(FallbackImage);
  });
});

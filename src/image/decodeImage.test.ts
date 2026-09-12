import { afterEach, describe, expect, it, vi } from 'vitest';
import { decodeImage } from './decodeImage';

function resizeCanvasWithContext(): HTMLCanvasElement {
  return {
    width: 0,
    height: 0,
    getContext: () => ({ drawImage: vi.fn() }),
  } as unknown as HTMLCanvasElement;
}

describe('decodeImage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
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

  it('automatically resizes a bitmap above the analysis limit', async () => {
    const bitmap = { width: 8193, height: 4096, close: vi.fn() } as unknown as ImageBitmap;
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(bitmap));
    vi.spyOn(document, 'createElement').mockReturnValue(resizeCanvasWithContext());

    const decoded = await decodeImage(new File(['x'], 'pose.jpg', { type: 'image/jpeg' }));

    expect(decoded.width).toBe(4096);
    expect(decoded.normalisation.wasResized).toBe(true);
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

  it('preserves a bitmap allocation failure as an actionable memory failure', async () => {
    let fallbackCreated = 0;
    class FallbackImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor() { fallbackCreated += 1; }
      set src(value: string) { if (value) queueMicrotask(() => this.onerror?.()); }
    }
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new RangeError('Out of memory')));
    vi.stubGlobal('Image', FallbackImage);

    await expect(decodeImage(new File(['x'], 'pose.jpg', { type: 'image/jpeg' }))).rejects.toEqual({
      code: 'image-memory-failed',
    });
    expect(fallbackCreated).toBe(0);
  });

  it('preserves an image-element allocation failure as an actionable memory failure', async () => {
    class MemoryFailureImage {
      onload: (() => void) | null = null;
      onerror: ((event: ErrorEvent) => void) | null = null;

      set src(value: string) {
        if (value) queueMicrotask(() => this.onerror?.(new ErrorEvent('error', {
          error: new RangeError('Out of memory'),
          message: 'Out of memory',
        })));
      }
    }

    vi.stubGlobal('createImageBitmap', undefined);
    vi.stubGlobal('Image', MemoryFailureImage);

    await expect(decodeImage(new File(['x'], 'pose.jpg', { type: 'image/jpeg' }))).rejects.toEqual({
      code: 'image-memory-failed',
    });
  });

  it('preserves an opaque native image-element error as a distinct decode failure', async () => {
    class OpaqueFailureImage {
      onload: (() => void) | null = null;
      onerror: ((event: Event) => void) | null = null;

      set src(value: string) {
        if (value) queueMicrotask(() => this.onerror?.(new Event('error')));
      }
    }

    vi.stubGlobal('createImageBitmap', undefined);
    vi.stubGlobal('Image', OpaqueFailureImage);

    await expect(decodeImage(new File(['x'], 'pose.jpg', { type: 'image/jpeg' }))).rejects.toEqual({
      code: 'decode-failed',
    });
  });

  it('preserves an opaque image-element failure after the bitmap decoder falls back', async () => {
    class OpaqueFallbackImage {
      onload: (() => void) | null = null;
      onerror: ((event: Event) => void) | null = null;

      set src(value: string) {
        if (value) queueMicrotask(() => this.onerror?.(new Event('error')));
      }
    }

    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new DOMException('Invalid image', 'EncodingError')));
    vi.stubGlobal('Image', OpaqueFallbackImage);

    await expect(decodeImage(new File(['x'], 'pose.jpg', { type: 'image/jpeg' }))).rejects.toEqual({
      code: 'decode-failed',
    });
  });
});

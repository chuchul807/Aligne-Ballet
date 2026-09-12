import type { ImageErrorCode } from './validateImageFile';
import { normaliseImage } from './normaliseImage';

export type { DecodedImage } from './normaliseImage';
import type { DecodedImage } from './normaliseImage';

type DecodeFailure = { code: Extract<ImageErrorCode, 'image-too-small' | 'normalisation-failed' | 'image-memory-failed' | 'decode-failed'> };

function memoryFailure(error: unknown): DecodeFailure | null {
  const cause = typeof error === 'object' && error !== null && 'error' in error
    ? error.error
    : error;
  const description = cause instanceof Error
    ? `${cause.name} ${cause.message}`
    : String(cause ?? '');
  return cause instanceof RangeError || /(?:out of memory|memory allocation|allocation failed|array buffer)/i.test(description)
    ? { code: 'image-memory-failed' }
    : null;
}

function isTerminalFailure(error: unknown): error is DecodeFailure {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && (error.code === 'image-too-small'
      || error.code === 'normalisation-failed'
      || error.code === 'image-memory-failed'
      || error.code === 'decode-failed');
}

function decodedBitmap(source: ImageBitmap): DecodedImage {
  return normaliseImage(source, () => source.close());
}

function decodeWithImageElement(file: File): Promise<DecodedImage> {
  return new Promise((resolve, reject) => {
    const source = new Image();
    const url = URL.createObjectURL(file);
    let revoked = false;

    const revoke = () => {
      if (!revoked) {
        revoked = true;
        URL.revokeObjectURL(url);
      }
    };

    source.onload = () => {
      revoke();
      try {
        resolve(normaliseImage(source, () => {
          source.src = '';
        }));
      } catch (error) {
        reject(error);
      }
    };
    source.onerror = (event) => {
      revoke();
      source.src = '';
      reject(memoryFailure(event) ?? { code: 'decode-failed' });
    };
    try {
      source.src = url;
    } catch (error) {
      revoke();
      source.src = '';
      reject(memoryFailure(error) ?? { code: 'decode-failed' });
    }
  });
}

export async function decodeImage(file: File): Promise<DecodedImage> {
  if (typeof createImageBitmap === 'function') {
    try {
      return decodedBitmap(await createImageBitmap(file, { imageOrientation: 'from-image' }));
    } catch (error) {
      const allocationFailure = memoryFailure(error);
      if (allocationFailure) throw allocationFailure;
      if (isTerminalFailure(error)) {
        throw error;
      }
    }
  }

  return decodeWithImageElement(file);
}

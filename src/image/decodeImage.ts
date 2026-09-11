import type { ImageErrorCode } from './validateImageFile';
import { normaliseImage } from './normaliseImage';

export type { DecodedImage } from './normaliseImage';
import type { DecodedImage } from './normaliseImage';

type DecodeFailure = { code: Extract<ImageErrorCode, 'image-too-small' | 'normalisation-failed' | 'decode-failed'> };

function isTerminalFailure(error: unknown): error is DecodeFailure {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && (error.code === 'image-too-small' || error.code === 'normalisation-failed');
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
    source.onerror = () => {
      revoke();
      source.src = '';
      reject({ code: 'decode-failed' });
    };
    source.src = url;
  });
}

export async function decodeImage(file: File): Promise<DecodedImage> {
  if (typeof createImageBitmap === 'function') {
    try {
      return decodedBitmap(await createImageBitmap(file, { imageOrientation: 'from-image' }));
    } catch (error) {
      if (isTerminalFailure(error)) {
        throw error;
      }
    }
  }

  return decodeWithImageElement(file);
}

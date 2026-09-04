import type { ImageErrorCode } from './validateImageFile';

export interface DecodedImage {
  source: ImageBitmap | HTMLImageElement;
  width: number;
  height: number;
  dispose(): void;
}

type DecodeFailure = { code: Extract<ImageErrorCode, 'image-too-small' | 'image-too-large' | 'decode-failed'> };

function isDimensionFailure(error: unknown): error is DecodeFailure {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && (error.code === 'image-too-small' || error.code === 'image-too-large');
}

function dimensionFailure(width: number, height: number): DecodeFailure | null {
  if (Math.min(width, height) < 480) {
    return { code: 'image-too-small' };
  }

  return Math.max(width, height) > 8192 ? { code: 'image-too-large' } : null;
}

function decodedBitmap(source: ImageBitmap): DecodedImage {
  const failure = dimensionFailure(source.width, source.height);
  if (failure) {
    source.close();
    throw failure;
  }

  let disposed = false;
  return {
    source,
    width: source.width,
    height: source.height,
    dispose: () => {
      if (!disposed) {
        disposed = true;
        source.close();
      }
    },
  };
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
      const failure = dimensionFailure(source.naturalWidth, source.naturalHeight);
      if (failure) {
        source.src = '';
        reject(failure);
        return;
      }

      let disposed = false;
      resolve({
        source,
        width: source.naturalWidth,
        height: source.naturalHeight,
        dispose: () => {
          if (!disposed) {
            disposed = true;
            source.src = '';
          }
        },
      });
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
      if (isDimensionFailure(error)) {
        throw error;
      }
    }
  }

  return decodeWithImageElement(file);
}

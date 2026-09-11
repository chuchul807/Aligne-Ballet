import type { ImageNormalisation } from '../domain/types';

export const MIN_IMAGE_SIDE = 480;
export const MAX_ANALYSIS_SIDE = 4096;

export interface DecodedImage {
  source: ImageBitmap | HTMLImageElement | HTMLCanvasElement;
  width: number;
  height: number;
  normalisation: ImageNormalisation;
  dispose(): void;
}

export function normaliseImage(
  source: ImageBitmap | HTMLImageElement,
  releaseSource: () => void,
  canvasFactory = () => document.createElement('canvas'),
): DecodedImage {
  const originalWidth = 'naturalWidth' in source ? source.naturalWidth : source.width;
  const originalHeight = 'naturalHeight' in source ? source.naturalHeight : source.height;
  if (Math.min(originalWidth, originalHeight) < MIN_IMAGE_SIDE) {
    releaseSource();
    throw { code: 'image-too-small' };
  }
  const scale = Math.min(1, MAX_ANALYSIS_SIDE / Math.max(originalWidth, originalHeight));
  const width = Math.round(originalWidth * scale);
  const height = Math.round(originalHeight * scale);
  if (scale === 1) return disposableSource(source, width, height, releaseSource, false, originalWidth, originalHeight);

  const canvas = canvasFactory();
  try {
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas context unavailable');
    context.drawImage(source, 0, 0, width, height);
  } catch {
    releaseSource();
    throw { code: 'normalisation-failed' };
  }
  releaseSource();
  return disposableCanvas(canvas, width, height, originalWidth, originalHeight);
}

function disposableSource(
  source: ImageBitmap | HTMLImageElement,
  width: number,
  height: number,
  releaseSource: () => void,
  wasResized: false,
  originalWidth: number,
  originalHeight: number,
): DecodedImage {
  let disposed = false;
  return {
    source,
    width,
    height,
    normalisation: { wasResized, originalWidth, originalHeight },
    dispose: () => {
      if (!disposed) {
        disposed = true;
        releaseSource();
      }
    },
  };
}

function disposableCanvas(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  originalWidth: number,
  originalHeight: number,
): DecodedImage {
  let disposed = false;
  return {
    source: canvas,
    width,
    height,
    normalisation: { wasResized: true, originalWidth, originalHeight },
    dispose: () => {
      if (!disposed) {
        disposed = true;
        canvas.width = 0;
        canvas.height = 0;
      }
    },
  };
}

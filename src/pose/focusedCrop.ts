import type { Landmark } from '../domain/types';

export const MIN_SUBJECT_VISIBILITY = 0.60;
export const MIN_TORSO_PIXELS = 48;
export const MIN_BODY_EXTENT_PIXELS = 180;
export const FOCUS_PADDING_RATIO = 0.20;

export interface CropRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export type SubjectSizeAssessment =
  | { status: 'usable'; torsoPixels: number; bodyExtentPixels: number }
  | { status: 'insufficient-evidence' }
  | { status: 'too-small' };

export interface FocusedCrop {
  source: CanvasImageSource;
  width: number;
  height: number;
  rect: CropRect;
  dispose: () => void;
}

export type CanvasFactory = () => HTMLCanvasElement;

const REQUIRED = ['left_shoulder', 'right_shoulder', 'left_hip', 'right_hip'] as const;

function validLandmark(landmark: Landmark): boolean {
  return Number.isFinite(landmark.x)
    && Number.isFinite(landmark.y)
    && landmark.x >= 0 && landmark.x <= 1
    && landmark.y >= 0 && landmark.y <= 1
    && Number.isFinite(landmark.visibility)
    && landmark.visibility >= MIN_SUBJECT_VISIBILITY
    && (landmark.presence === undefined
      || (Number.isFinite(landmark.presence) && landmark.presence >= MIN_SUBJECT_VISIBILITY));
}

function evidence(landmarks: readonly Landmark[]): Landmark[] {
  return landmarks.filter(validLandmark);
}

function requiredEvidence(landmarks: readonly Landmark[]): Landmark[] | null {
  const usable = evidence(landmarks);
  const names = new Set(usable.map((landmark) => landmark.name));
  if (!REQUIRED.every((name) => names.has(name))
    || !usable.some((landmark) => landmark.name === 'left_ankle' || landmark.name === 'right_ankle')) {
    return null;
  }
  return usable;
}

function find(landmarks: readonly Landmark[], name: string): Landmark {
  return landmarks.find((landmark) => landmark.name === name)!;
}

export function assessSubjectSize(
  landmarks: readonly Landmark[],
  sourceWidth: number,
  sourceHeight: number,
): SubjectSizeAssessment {
  const usable = requiredEvidence(landmarks);
  if (!usable || sourceWidth <= 0 || sourceHeight <= 0) return { status: 'insufficient-evidence' };

  const shoulderMidpoint = {
    x: (find(usable, 'left_shoulder').x + find(usable, 'right_shoulder').x) / 2,
    y: (find(usable, 'left_shoulder').y + find(usable, 'right_shoulder').y) / 2,
  };
  const hipMidpoint = {
    x: (find(usable, 'left_hip').x + find(usable, 'right_hip').x) / 2,
    y: (find(usable, 'left_hip').y + find(usable, 'right_hip').y) / 2,
  };
  const torsoPixels = Math.hypot(
    (hipMidpoint.x - shoulderMidpoint.x) * sourceWidth,
    (hipMidpoint.y - shoulderMidpoint.y) * sourceHeight,
  );
  const xs = usable.map((landmark) => landmark.x * sourceWidth);
  const ys = usable.map((landmark) => landmark.y * sourceHeight);
  const bodyExtentPixels = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  if (torsoPixels < MIN_TORSO_PIXELS || bodyExtentPixels < MIN_BODY_EXTENT_PIXELS) return { status: 'too-small' };
  return { status: 'usable', torsoPixels, bodyExtentPixels };
}

export function calculateFocusRect(
  landmarks: readonly Landmark[],
  sourceWidth: number,
  sourceHeight: number,
): CropRect | null {
  if (assessSubjectSize(landmarks, sourceWidth, sourceHeight).status !== 'usable') return null;
  const usable = requiredEvidence(landmarks)!;
  const xs = usable.map((landmark) => landmark.x * sourceWidth);
  const ys = usable.map((landmark) => landmark.y * sourceHeight);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  const right = Math.max(...xs);
  const bottom = Math.max(...ys);
  const padX = (right - left) * FOCUS_PADDING_RATIO;
  const padY = (bottom - top) * FOCUS_PADDING_RATIO;
  const clampedLeft = Math.max(0, left - padX);
  const clampedTop = Math.max(0, top - padY);
  const clampedRight = Math.min(sourceWidth, right + padX);
  const clampedBottom = Math.min(sourceHeight, bottom + padY);
  return { left: clampedLeft, top: clampedTop, width: clampedRight - clampedLeft, height: clampedBottom - clampedTop };
}

export function mapLandmarksFromCrop(
  landmarks: readonly Landmark[],
  rect: CropRect,
  sourceWidth: number,
  sourceHeight: number,
): readonly Landmark[] {
  return landmarks.map((landmark) => {
    const mapped = {
      ...landmark,
      x: (rect.left + landmark.x * rect.width) / sourceWidth,
      y: (rect.top + landmark.y * rect.height) / sourceHeight,
    };
    return landmark.z === undefined
      ? mapped
      : { ...mapped, z: landmark.z * rect.width / sourceWidth };
  });
}

export function createFocusedCrop(
  source: CanvasImageSource,
  rect: CropRect,
  canvasFactory: CanvasFactory = () => document.createElement('canvas'),
): FocusedCrop {
  let canvas: HTMLCanvasElement | undefined;
  try {
    canvas = canvasFactory();
    const scale = Math.min(1, 4096 / Math.max(rect.width, rect.height));
    const width = Math.round(rect.width * scale);
    const height = Math.round(rect.height * scale);
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('2d context unavailable');
    context.drawImage(source, rect.left, rect.top, rect.width, rect.height, 0, 0, width, height);
    let disposed = false;
    return {
      source: canvas,
      width,
      height,
      rect,
      dispose: () => {
        if (disposed) return;
        disposed = true;
        canvas!.width = 0;
        canvas!.height = 0;
      },
    };
  } catch {
    if (canvas) {
      try { canvas.width = 0; } catch { /* best-effort cleanup */ }
      try { canvas.height = 0; } catch { /* best-effort cleanup */ }
    }
    throw { code: 'image-memory-failed' };
  }
}

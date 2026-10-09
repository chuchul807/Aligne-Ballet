import { describe, expect, it } from 'vitest';
import type { Landmark } from '../domain/types';
import type { LandmarkName } from '../domain/landmarks';
import {
  assessSubjectSize,
  calculateFocusRect,
  createFocusedCrop,
  mapLandmarksFromCrop,
} from './focusedCrop';

const point = (name: LandmarkName, x: number, y: number, extra: Partial<Landmark> = {}): Landmark => ({
  name,
  x,
  y,
  visibility: 0.9,
  ...extra,
});

function sizedPerson({ torsoNormalised, extentNormalised }: { torsoNormalised: number; extentNormalised: number }): Landmark[] {
  const shoulderY = 0.5 - torsoNormalised / 2;
  const hipY = 0.5 + torsoNormalised / 2;
  const ankleY = Math.min(0.99, hipY + extentNormalised - torsoNormalised);
  return [
    point('left_shoulder', 0.4, shoulderY),
    point('right_shoulder', 0.6, shoulderY),
    point('left_hip', 0.4, hipY),
    point('right_hip', 0.6, hipY),
    point('left_ankle', 0.5, ankleY),
  ];
}

function boxPerson(left: number, top: number, right: number, bottom: number): Landmark[] {
  return [
    point('left_shoulder', left, top),
    point('right_shoulder', right, top),
    point('left_hip', left, top + (bottom - top) * 0.25),
    point('right_hip', right, top + (bottom - top) * 0.25),
    point('left_ankle', left, bottom),
  ];
}

describe('focused crop geometry', () => {
  it.each([
    [179, 'too-small'],
    [180, 'usable'],
    [181, 'usable'],
  ] as const)('classifies a %i pixel body extent independently of its 100 pixel width', (extent, status) => {
    // Power-of-two dimensions make the 48 px torso and extent boundaries exact.
    const person = [
      point('left_shoulder', 400 / 1024, 256 / 1024),
      point('right_shoulder', 500 / 1024, 256 / 1024),
      point('left_hip', 400 / 1024, 304 / 1024),
      point('right_hip', 500 / 1024, 304 / 1024),
      point('left_ankle', 450 / 1024, (256 + extent) / 1024),
    ];
    const assessment = assessSubjectSize(person, 1024, 1024);

    expect(assessment.status).toBe(status);
    if (status === 'usable') {
      expect(assessment).toEqual({ status: 'usable', torsoPixels: 48, bodyExtentPixels: extent });
    }
  });

  it('rejects a dancer whose torso is under 48 source pixels', () => {
    const person = sizedPerson({ torsoNormalised: 0.047, extentNormalised: 0.30 });
    expect(assessSubjectSize(person, 1000, 1000)).toEqual({ status: 'too-small' });
  });

  it('requires reliable structural evidence', () => {
    const person = sizedPerson({ torsoNormalised: 0.2, extentNormalised: 0.3 }).filter((landmark) => landmark.name !== 'left_ankle');
    expect(assessSubjectSize(person, 1000, 1000)).toEqual({ status: 'insufficient-evidence' });
  });

  it('ignores low-presence landmarks when measuring evidence', () => {
    const person = sizedPerson({ torsoNormalised: 0.2, extentNormalised: 0.3 }).map((landmark) =>
      landmark.name === 'left_ankle' ? { ...landmark, presence: 0.59 } : landmark,
    );
    expect(assessSubjectSize(person, 1000, 1000)).toEqual({ status: 'insufficient-evidence' });
  });

  it('pads every side by 20 percent and clamps at the image edge', () => {
    const rect = calculateFocusRect(boxPerson(0.10, 0.20, 0.80, 0.90), 1000, 1000);
    expect(rect).toEqual({ left: 0, top: 60, width: 940, height: 940 });
  });

  it('maps crop coordinates back to the original image', () => {
    const mapped = mapLandmarksFromCrop([
      { name: 'left_knee', x: 0.5, y: 0.25, z: 0.2, visibility: 0.9 },
    ], { left: 200, top: 100, width: 400, height: 800 }, 1000, 1200);
    expect(mapped[0]).toMatchObject({ x: 0.4, y: 0.25, z: 0.08 });
  });

  it('creates an owned, aspect-preserving crop canvas and disposes it', () => {
    const drawCalls: unknown[][] = [];
    const drawImage = (...args: unknown[]) => { drawCalls.push(args); };
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({ drawImage }),
    } as unknown as HTMLCanvasElement;
    const source = {} as CanvasImageSource;
    const crop = createFocusedCrop(source, { left: 100, top: 200, width: 5000, height: 2500 }, () => canvas);
    expect([crop.width, crop.height]).toEqual([4096, 2048]);
    expect(drawCalls).toEqual([[source, 100, 200, 5000, 2500, 0, 0, 4096, 2048]]);
    crop.dispose();
    expect(canvas.width).toBe(0);
    expect(canvas.height).toBe(0);
    crop.dispose();
  });

  it('throws the stable memory error when canvas drawing fails', () => {
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => null,
    } as unknown as HTMLCanvasElement;
    try {
      createFocusedCrop({} as CanvasImageSource, { left: 0, top: 0, width: 10, height: 10 }, () => canvas);
      throw new Error('expected crop creation to fail');
    } catch (error) {
      expect(error).toEqual({ code: 'image-memory-failed' });
    }
  });

  it('clears the canvas dimensions when drawImage fails', () => {
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({ drawImage: () => { throw new Error('draw failed'); } }),
    } as unknown as HTMLCanvasElement;
    expect(() => createFocusedCrop(
      {} as CanvasImageSource,
      { left: 0, top: 0, width: 500, height: 250 },
      () => canvas,
    )).toThrow();
    expect(canvas.width).toBe(0);
    expect(canvas.height).toBe(0);
  });
});

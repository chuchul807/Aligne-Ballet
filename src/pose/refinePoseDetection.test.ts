import { describe, expect, it, vi } from 'vitest';
import type { LandmarkSet, Landmark } from '../domain/types';
import type { LandmarkName } from '../domain/landmarks';
import type { PoseDetector } from './PoseDetector';
import { refinePoseDetection, type RefinePoseInput } from './refinePoseDetection';

const point = (name: LandmarkName, x: number, y: number): Landmark => ({
  name,
  x,
  y,
  visibility: 0.9,
});

function usablePerson(): Landmark[] {
  return [
    point('left_shoulder', 0.3, 0.2),
    point('right_shoulder', 0.7, 0.2),
    point('left_hip', 0.3, 0.5),
    point('right_hip', 0.7, 0.5),
    point('left_knee', 0.3, 0.7),
    point('left_ankle', 0.3, 0.85),
  ];
}

function landmarkSet(people: ReadonlyArray<ReadonlyArray<Landmark>>): LandmarkSet {
  return { people, sourceWidth: 1000, sourceHeight: 1500 };
}

function canvasFactory() {
  const drawImage = vi.fn();
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ({ drawImage }),
  } as unknown as HTMLCanvasElement;
  return { canvas, factory: vi.fn(() => canvas) };
}

function inputFor(
  detector: PoseDetector,
  whole: LandmarkSet = landmarkSet([usablePerson()]),
  factory = canvasFactory(),
): RefinePoseInput {
  return {
    whole,
    source: {} as CanvasImageSource,
    width: 1000,
    height: 1500,
    detector,
    canvasFactory: factory.factory,
  };
}

function detectorReturning(people: ReadonlyArray<ReadonlyArray<Landmark>>) {
  return {
    detect: vi.fn(async () => landmarkSet(people)),
    close: vi.fn(),
  } satisfies PoseDetector;
}

function inputWithObservableCrop(detector: PoseDetector, whole: LandmarkSet = landmarkSet([usablePerson()])) {
  const dispose = vi.fn();
  const createCrop = vi.fn(() => ({
    source: {} as CanvasImageSource,
    width: 560,
    height: 1365,
    rect: { left: 220, top: 105, width: 560, height: 1365 },
    dispose,
  }));
  return {
    input: {
      ...inputFor(detector, whole),
      createCrop,
    },
    dispose,
  };
}

describe('focused pose refinement', () => {
  it('compares mapped landmarks using the source aspect ratio rather than crop dimensions', async () => {
    // Whole-image bounds: x 600..1400, y 200..850; padded crop: 440,70,1120,910.
    // A 60 px horizontal knee shift is 0.20 of the unchanged 300 px torso.
    const wholePerson = usablePerson();
    const focusedPerson = wholePerson.map((landmark) => ({
      ...landmark,
      x: (landmark.x * 2000 + (landmark.name === 'left_knee' ? 60 : 0) - 440) / 1120,
      y: (landmark.y * 1000 - 70) / 910,
    }));
    const detector = detectorReturning([focusedPerson]);

    const outcome = await refinePoseDetection({
      ...inputFor(detector),
      width: 2000,
      height: 1000,
      whole: { people: [wholePerson], sourceWidth: 2000, sourceHeight: 1000 },
    });

    expect(outcome.status).toBe('success');
    if (outcome.status === 'success') {
      expect(outcome.disagreements).toContain('left_knee');
      expect(outcome.disagreements).not.toContain('left_shoulder');
    }
  });

  it('runs exactly one focused pass and maps its landmarks to the whole image', async () => {
    const focusedPerson = [
      point('left_shoulder', 0.15, 0.10),
      point('right_shoulder', 0.85, 0.10),
      point('left_hip', 0.15, 0.40),
      point('right_hip', 0.85, 0.40),
      point('left_knee', 0.5, 0.5),
      point('left_ankle', 0.15, 0.85),
    ];
    const detector = detectorReturning([focusedPerson]);
    const { canvas, factory } = canvasFactory();

    const outcome = await refinePoseDetection(inputFor(detector, landmarkSet([usablePerson()]), { canvas, factory }));

    expect(detector.detect).toHaveBeenCalledOnce();
    expect(detector.detect).toHaveBeenCalledWith(canvas, 560, 1365);
    expect(outcome).toMatchObject({
      status: 'success',
      landmarks: { sourceWidth: 1000, sourceHeight: 1500 },
    });
    expect(outcome.status === 'success' && outcome.landmarks.people[0]?.find((landmark) => landmark.name === 'left_knee'))
      .toMatchObject({ x: 0.5, y: 0.525 });
    expect(canvas.width).toBe(0);
    expect(canvas.height).toBe(0);
  });

  it('returns subject-too-small without creating a crop', async () => {
    const detector = detectorReturning([usablePerson()]);
    const { factory } = canvasFactory();
    const tooSmall = [
      point('left_shoulder', 0.4, 0.495),
      point('right_shoulder', 0.6, 0.495),
      point('left_hip', 0.4, 0.505),
      point('right_hip', 0.6, 0.505),
      point('left_ankle', 0.5, 0.8),
    ];

    await expect(refinePoseDetection(inputFor(detector, landmarkSet([tooSmall]), { canvas: {} as HTMLCanvasElement, factory })))
      .resolves.toEqual({ status: 'subject-too-small' });
    expect(detector.detect).not.toHaveBeenCalled();
    expect(factory).not.toHaveBeenCalled();
  });

  it.each([
    ['no whole-image person', landmarkSet([])],
    ['insufficient crop evidence', landmarkSet([usablePerson().filter((landmark) => landmark.name !== 'left_ankle')])],
  ])('returns insufficient-pose-evidence for %s without creating a crop', async (_label, whole) => {
    const detector = detectorReturning([usablePerson()]);
    const { factory } = canvasFactory();

    await expect(refinePoseDetection(inputFor(detector, whole, { canvas: {} as HTMLCanvasElement, factory })))
      .resolves.toEqual({ status: 'insufficient-pose-evidence' });
    expect(detector.detect).not.toHaveBeenCalled();
    expect(factory).not.toHaveBeenCalled();
  });

  it.each([
    ['no refined person', []],
    ['multiple refined people', [usablePerson(), usablePerson()]],
  ] as const)('returns unstable-pose-landmarks and clears the crop for %s', async (_label, people) => {
    const detector = detectorReturning(people);
    const { canvas, factory } = canvasFactory();

    await expect(refinePoseDetection(inputFor(detector, landmarkSet([usablePerson()]), { canvas, factory })))
      .resolves.toEqual({ status: 'unstable-pose-landmarks' });
    expect(detector.detect).toHaveBeenCalledOnce();
    expect(canvas.width).toBe(0);
    expect(canvas.height).toBe(0);
  });

  it('clears the crop when the focused detector rejects', async () => {
    const detector = {
      detect: vi.fn(async () => { throw new Error('detector failed'); }),
      close: vi.fn(),
    } satisfies PoseDetector;
    const { canvas, factory } = canvasFactory();

    await expect(refinePoseDetection(inputFor(detector, landmarkSet([usablePerson()]), { canvas, factory })))
      .rejects.toThrow('detector failed');
    expect(detector.detect).toHaveBeenCalledOnce();
    expect(canvas.width).toBe(0);
    expect(canvas.height).toBe(0);
  });

  it('disposes the owned crop exactly once after success', async () => {
    const { input, dispose } = inputWithObservableCrop(detectorReturning([usablePerson()]));

    await expect(refinePoseDetection(input)).resolves.toMatchObject({ status: 'success' });

    expect(dispose).toHaveBeenCalledOnce();
  });

  it.each([
    ['zero refined people', detectorReturning([])],
    ['multiple refined people', detectorReturning([usablePerson(), usablePerson()])],
  ] as const)('disposes the owned crop exactly once for %s', async (_label, detector) => {
    const { input, dispose } = inputWithObservableCrop(detector);

    await expect(refinePoseDetection(input)).resolves.toEqual({ status: 'unstable-pose-landmarks' });

    expect(dispose).toHaveBeenCalledOnce();
  });

  it('disposes the owned crop exactly once when the focused detector rejects', async () => {
    const detector = {
      detect: vi.fn(async () => { throw new Error('detector failed'); }),
      close: vi.fn(),
    } satisfies PoseDetector;
    const { input, dispose } = inputWithObservableCrop(detector);

    await expect(refinePoseDetection(input)).rejects.toThrow('detector failed');

    expect(dispose).toHaveBeenCalledOnce();
  });
});

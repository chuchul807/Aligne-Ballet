import type { LandmarkName } from '../domain/landmarks';
import type { LandmarkSet } from '../domain/types';
import type { CanvasFactory } from './focusedCrop';
import {
  assessSubjectSize,
  calculateFocusRect,
  createFocusedCrop,
  mapLandmarksFromCrop,
} from './focusedCrop';
import type { PoseDetector } from './PoseDetector';
import { comparePosePasses } from './poseAgreement';

export interface RefinePoseInput {
  whole: LandmarkSet;
  source: CanvasImageSource;
  width: number;
  height: number;
  detector: PoseDetector;
  canvasFactory?: CanvasFactory;
  createCrop?: typeof createFocusedCrop;
}

export type RefinedPoseOutcome =
  | { status: 'success'; landmarks: LandmarkSet; disagreements: ReadonlySet<LandmarkName> }
  | { status: 'subject-too-small' }
  | { status: 'insufficient-pose-evidence' }
  | { status: 'unstable-pose-landmarks' };

export async function refinePoseDetection(input: RefinePoseInput): Promise<RefinedPoseOutcome> {
  const person = input.whole.people[0];
  if (!person) return { status: 'insufficient-pose-evidence' };

  const size = assessSubjectSize(person, input.width, input.height);
  if (size.status === 'too-small') return { status: 'subject-too-small' };
  if (size.status !== 'usable') return { status: 'insufficient-pose-evidence' };

  const rect = calculateFocusRect(person, input.width, input.height);
  if (!rect) return { status: 'insufficient-pose-evidence' };

  const crop = (input.createCrop ?? createFocusedCrop)(input.source, rect, input.canvasFactory);
  try {
    const detected = await input.detector.detect(crop.source, crop.width, crop.height);
    if (detected.people.length !== 1) return { status: 'unstable-pose-landmarks' };

    const mapped = mapLandmarksFromCrop(detected.people[0]!, rect, input.width, input.height);
    return {
      status: 'success',
      landmarks: { people: [mapped], sourceWidth: input.width, sourceHeight: input.height },
      disagreements: comparePosePasses(person, mapped, input.width, input.height),
    };
  } finally {
    crop.dispose();
  }
}

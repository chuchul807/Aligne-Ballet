import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import type { ImageSource } from '@mediapipe/tasks-vision';
import { landmarkNames } from '../domain/landmarks';
import type { LandmarkSet } from '../domain/types';
import type { PoseDetector } from './PoseDetector';

interface MediaPipeLandmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
  presence?: number;
}

interface MediaPipePoseResult {
  landmarks: ReadonlyArray<ReadonlyArray<MediaPipeLandmark>>;
}

export function mapMediaPipeResult(
  result: MediaPipePoseResult,
  sourceWidth: number,
  sourceHeight: number,
): LandmarkSet {
  return {
    sourceWidth,
    sourceHeight,
    people: result.landmarks.map((person) => person.slice(0, landmarkNames.length).map((point, index) => {
      const mapped = {
        name: landmarkNames[index]!,
        x: point.x,
        y: point.y,
        z: point.z,
        visibility: point.visibility,
      };
      return point.presence !== undefined && Number.isFinite(point.presence)
        ? { ...mapped, presence: point.presence }
        : mapped;
    })),
  };
}

export const POSE_MODEL_ASSET_PATH = '/models/pose_landmarker_heavy.task';

export async function createMediaPipePoseDetector(): Promise<PoseDetector> {
  const files = await FilesetResolver.forVisionTasks('/vendor/mediapipe/wasm');
  const landmarker = await PoseLandmarker.createFromOptions(files, {
    baseOptions: { modelAssetPath: POSE_MODEL_ASSET_PATH },
    runningMode: 'IMAGE',
    numPoses: 2,
    minPoseDetectionConfidence: 0.5,
    minPosePresenceConfidence: 0.5,
  });

  return {
    async detect(source, width, height) {
      return mapMediaPipeResult(landmarker.detect(source as unknown as ImageSource), width, height);
    },
    close() {
      landmarker.close();
    },
  };
}

import type { LandmarkSet } from '../domain/types';

/**
 * Browser-frame detector boundary. Future video adapters can implement the
 * same contract for a decoded key frame without exposing provider types.
 */
export interface PoseDetector {
  detect(source: CanvasImageSource, width: number, height: number): Promise<LandmarkSet>;
  close(): void;
}

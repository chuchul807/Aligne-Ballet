import type { BodyRegion } from '../domain/types';

export type QualityReasonCode =
  | 'no-person'
  | 'multiple-people'
  | 'body-out-of-frame'
  | 'required-joints-not-visible'
  | 'insufficient-pose-evidence'
  | 'subject-too-small'
  | 'unstable-pose-landmarks'
  | 'wrong-camera-view'
  | 'too-dark'
  | 'too-bright'
  | 'low-contrast'
  | 'blurred'
  | 'image-too-small'
  | 'normalisation-failed'
  | 'image-memory-failed'
  | 'decode-failed';

export interface QualityReason {
  code: QualityReasonCode;
  message: string;
}

export interface QualityReport {
  status: 'pass' | 'partial' | 'fail';
  reasons: readonly QualityReason[];
  unassessableRegions: readonly BodyRegion[];
  imageWasResized?: boolean;
}

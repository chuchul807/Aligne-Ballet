import type { BodyRegion } from '../domain/types';

export type QualityReasonCode =
  | 'no-person'
  | 'multiple-people'
  | 'body-out-of-frame'
  | 'required-joints-not-visible'
  | 'wrong-camera-view'
  | 'too-dark'
  | 'too-bright'
  | 'low-contrast'
  | 'blurred';

export interface QualityReport {
  status: 'pass' | 'partial' | 'fail';
  reasons: readonly { code: QualityReasonCode; message: string }[];
  unassessableRegions: readonly BodyRegion[];
}

import type { Landmark, LandmarkSet, PoseName, SupportingSide, ViewType } from '../domain/types';
import type { LandmarkName } from '../domain/landmarks';
import type { ImageMetrics } from '../image/imageMetrics';
import { QUALITY_MESSAGES } from './messages';
import type { QualityReason, QualityReasonCode, QualityReport } from './types';

export const QUALITY_THRESHOLDS = {
  minMeanLuminance: 0.10,
  maxMeanLuminance: 0.94,
  maxTooBrightContrast: 0.10,
  minContrast: 0.075,
  minEdgeEnergy: 0.08,
  minRequiredVisibility: 0.60,
  frameMargin: 0.02,
} as const;

const requiredLandmarks = [
  'left_shoulder', 'right_shoulder', 'left_hip', 'right_hip',
  'left_knee', 'right_knee', 'left_ankle', 'right_ankle',
  'left_heel', 'right_heel', 'left_foot_index', 'right_foot_index',
] as const satisfies readonly LandmarkName[];

const handLandmarks = ['left_wrist', 'right_wrist'] as const satisfies readonly LandmarkName[];
const optionalArmLandmarks = ['left_elbow', 'right_elbow', ...handLandmarks] as const satisfies readonly LandmarkName[];

export interface QualityInput {
  landmarks: LandmarkSet;
  position: PoseName;
  supportingSide: SupportingSide;
  expectedView: ViewType;
  metrics: ImageMetrics;
  requiredJointVisibility?: 'enforce' | 'defer';
  cameraViewCheck?: 'enforce' | 'defer';
}

function indexPerson(person: readonly Landmark[]): Map<LandmarkName, Landmark> {
  return new Map(person.map((landmark) => [landmark.name, landmark]));
}

function isInsideFrame(landmark: Landmark): boolean {
  return landmark.x >= QUALITY_THRESHOLDS.frameMargin
    && landmark.x <= 1 - QUALITY_THRESHOLDS.frameMargin
    && landmark.y >= QUALITY_THRESHOLDS.frameMargin
    && landmark.y <= 1 - QUALITY_THRESHOLDS.frameMargin;
}

function distance(a: Landmark, b: Landmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function apparentViewRatio(points: Map<LandmarkName, Landmark>): number | null {
  const leftShoulder = points.get('left_shoulder');
  const rightShoulder = points.get('right_shoulder');
  const leftHip = points.get('left_hip');
  const rightHip = points.get('right_hip');
  if (!leftShoulder || !rightShoulder || !leftHip || !rightHip) return null;

  const shoulderWidth = distance(leftShoulder, rightShoulder);
  const hipWidth = distance(leftHip, rightHip);
  const shoulderMidpoint = { x: (leftShoulder.x + rightShoulder.x) / 2, y: (leftShoulder.y + rightShoulder.y) / 2 };
  const hipMidpoint = { x: (leftHip.x + rightHip.x) / 2, y: (leftHip.y + rightHip.y) / 2 };
  const torsoLength = Math.hypot(shoulderMidpoint.x - hipMidpoint.x, shoulderMidpoint.y - hipMidpoint.y);
  return torsoLength === 0 ? null : ((shoulderWidth + hipWidth) / 2) / torsoLength;
}

function hasExpectedView(ratio: number | null, expectedView: ViewType): boolean {
  if (ratio === null) return false;
  return expectedView === 'front' ? ratio >= 0.55 : ratio >= 0.25 && ratio <= 0.85;
}

function reason(code: QualityReasonCode): QualityReason {
  return { code, message: QUALITY_MESSAGES[code] };
}

export function evaluateQuality(input: QualityInput): QualityReport {
  const reasons: QualityReason[] = [];
  const { people } = input.landmarks;
  if (people.length === 0) reasons.push(reason('no-person'));
  if (people.length > 1) reasons.push(reason('multiple-people'));

  const person = people.length === 1 ? people[0] : undefined;
  const points = person ? indexPerson(person) : new Map<LandmarkName, Landmark>();
  if (person) {
    const required = requiredLandmarks.map((name) => points.get(name));
    if (required.some((landmark) => !landmark || !isInsideFrame(landmark))
      || handLandmarks.some((name) => {
        const landmark = points.get(name);
        return landmark !== undefined && landmark.visibility >= QUALITY_THRESHOLDS.minRequiredVisibility && !isInsideFrame(landmark);
      })) {
      reasons.push(reason('body-out-of-frame'));
    }
    if (input.requiredJointVisibility !== 'defer'
      && required.some((landmark) => !landmark || landmark.visibility < QUALITY_THRESHOLDS.minRequiredVisibility)) {
      reasons.push(reason('required-joints-not-visible'));
    }
    if (input.cameraViewCheck !== 'defer'
      && !hasExpectedView(apparentViewRatio(points), input.expectedView)) {
      reasons.push(reason('wrong-camera-view'));
    }
  }

  if (input.metrics.meanLuminance < QUALITY_THRESHOLDS.minMeanLuminance) reasons.push(reason('too-dark'));
  if (input.metrics.meanLuminance > QUALITY_THRESHOLDS.maxMeanLuminance
    && input.metrics.contrast < QUALITY_THRESHOLDS.maxTooBrightContrast) {
    reasons.push(reason('too-bright'));
  }
  if (input.metrics.contrast < QUALITY_THRESHOLDS.minContrast) reasons.push(reason('low-contrast'));
  if (input.metrics.edgeEnergy < QUALITY_THRESHOLDS.minEdgeEnergy) reasons.push(reason('blurred'));

  if (reasons.length > 0) return { status: 'fail', reasons, unassessableRegions: [] };

  const armsUnassessable = optionalArmLandmarks.some((name) => {
    const landmark = points.get(name);
    return !landmark || landmark.visibility < QUALITY_THRESHOLDS.minRequiredVisibility;
  });
  return armsUnassessable
    ? { status: 'partial', reasons: [], unassessableRegions: ['shoulders-arms'] }
    : { status: 'pass', reasons: [], unassessableRegions: [] };
}

import { createSessionId } from './createSessionId';
import type { LandmarkName } from './landmarks';

export type PoseName =
  | 'arabesque'
  | 'attitude-derriere'
  | 'retire-passe'
  | 'a-la-seconde'
  | 'tendu-croise-devant';
export type SupportingSide = 'left' | 'right';
export type ViewType = 'front' | 'three-quarter-side';
export type FrameKind = 'image' | 'video-keyframe';
export type Confidence = 'high' | 'medium' | 'low';
export type Assessability = 'assessable' | 'unassessable';
export type Priority = 'stability' | 'structure' | 'line';
export type AnalysisStatus = 'select' | 'frame' | 'check' | 'result';
export type BodyRegion =
  | 'supporting-leg'
  | 'working-leg'
  | 'pelvis'
  | 'torso'
  | 'shoulders-arms'
  | 'head'
  | 'feet';

export interface ImageNormalisation {
  wasResized: boolean;
  originalWidth: number;
  originalHeight: number;
}

export interface Landmark {
  name: LandmarkName;
  x: number;
  y: number;
  z?: number;
  visibility: number;
  presence?: number;
}

export type ReliabilityReason =
  | 'missing'
  | 'non-finite'
  | 'low-visibility'
  | 'low-presence'
  | 'outside-frame'
  | 'implausible-chain'
  | 'possible-occlusion'
  | 'cross-pass-disagreement';

export interface LandmarkReliability {
  name: LandmarkName;
  confidence: Confidence;
  assessability: Assessability;
  reasons: readonly ReliabilityReason[];
}

export type LandmarkReliabilityMap = ReadonlyMap<LandmarkName, LandmarkReliability>;

export interface PoseMeasurement {
  value: number | null;
  confidence: Confidence;
  assessability: Assessability;
  evidence: readonly LandmarkName[];
  reason?: ReliabilityReason | 'missing-geometry' | 'unsupported-view';
}

export interface MeasurementSet {
  torsoLength: PoseMeasurement;
  supportingKneeAngle: PoseMeasurement;
  /** Positive when the supporting knee is closer to the camera than the hip-to-ankle depth line. */
  supportingKneeForwardDepthCue: PoseMeasurement;
  workingKneeAngle: PoseMeasurement;
  /** Positive when the working knee is closer to the camera than the hip-to-ankle depth line. */
  workingKneeForwardDepthCue: PoseMeasurement;
  pelvisSlope: PoseMeasurement;
  shoulderSlope: PoseMeasurement;
  torsoLateralOffset: PoseMeasurement;
  workingAnkleToSupportingKnee: PoseMeasurement;
  workingKneeLateralOffset: PoseMeasurement;
  workingKneeHeightFromHip: PoseMeasurement;
  workingAnkleHeightFromHip: PoseMeasurement;
  workingFootPointAngle: PoseMeasurement;
  /** Positive when the working heel is estimated closer to the camera than the toes. */
  workingHeelDepthCue: PoseMeasurement;
  /** Positive when the heel remains visibly inside the working toes in a frontal view. */
  workingHeelVisibilityCue: PoseMeasurement;
  /** Positive when the working ankle travels outward from its hip in the frontal plane. */
  workingAnkleOutwardOffset: PoseMeasurement;
  workingFootHeightFromSupportingFoot: PoseMeasurement;
  croiseCrossingSeparation: PoseMeasurement;
  frontalSupportingHipAnkleOffset: PoseMeasurement;
  leftElbowAngle: PoseMeasurement;
  rightElbowAngle: PoseMeasurement;
  headTiltFromTorso: PoseMeasurement;
}

export interface LandmarkSet {
  people: ReadonlyArray<ReadonlyArray<Landmark>>;
  sourceWidth: number;
  sourceHeight: number;
}

export interface PoseFrame {
  id: string;
  kind: FrameKind;
  view: ViewType;
  sourceWidth: number;
  sourceHeight: number;
  createdAt: string;
}

export interface ObservationBase {
  id: string;
  ruleId: string;
  dedupeKey: string;
  region: BodyRegion;
  priority: Priority;
  confidence: Confidence;
  evidence: readonly string[];
  annotation: readonly AnnotationInstruction[];
}

export type Observation =
  | (ObservationBase & {
      assessability: 'assessable';
      issue: string;
      action: string;
      direction: string;
      severity: number;
    })
  | (ObservationBase & {
      assessability: 'unassessable';
      issue: null;
      action: null;
      direction: null;
      severity: null;
      confidence: 'low';
    });

export interface AnnotationInstruction {
  observationId: string;
  type: 'joint' | 'region' | 'arrow';
  joints: readonly LandmarkName[];
  dx?: number;
  dy?: number;
}

export type DrawingCommand =
  | { type: 'skeleton-segment'; from: LandmarkName; to: LandmarkName }
  | { type: 'structural-joint'; joint: LandmarkName }
  | { type: 'highlight-joint'; observationId: string; joint: LandmarkName; label: 1 | 2 | 3 }
  | { type: 'highlight-region'; observationId: string; joints: readonly LandmarkName[]; label: 1 | 2 | 3 }
  | { type: 'direction-arrow'; observationId: string; anchor: LandmarkName; dx: number; dy: number; label: 1 | 2 | 3 };

export interface FeedbackItem {
  observationId: string;
  text: string;
  region: BodyRegion;
  priority: Priority;
  confidence: Exclude<Confidence, 'low'>;
}

export interface CorrectionFeedbackItem extends FeedbackItem {
  ruleId: string;
  /** Natural-language audit context; evaluation uses the ruleId codebook instead. */
  direction: string;
}

export interface FullBodySection {
  region: BodyRegion;
  status: 'finding' | 'clear' | 'unassessable';
  items: readonly FeedbackItem[];
}

export interface AnalysisResult {
  sessionId: string;
  position: PoseName;
  landmarks: readonly Landmark[];
  topCorrections: readonly CorrectionFeedbackItem[];
  fullBodyReview: readonly FullBodySection[];
  annotations: readonly DrawingCommand[];
  createdAt: string;
}

export interface AnalysisSession {
  id: string;
  position: PoseName;
  supportingSide: SupportingSide;
  expectedViews: readonly ViewType[];
  frames: readonly PoseFrame[];
  status: AnalysisStatus;
  createdAt: string;
}

export function createAnalysisSession(
  position: PoseName,
  supportingSide: SupportingSide,
  view: ViewType,
  createdAt = new Date().toISOString(),
): AnalysisSession {
  return {
    id: createSessionId(),
    position,
    supportingSide,
    expectedViews: [view],
    frames: [],
    status: 'select',
    createdAt,
  };
}

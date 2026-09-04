import type { LandmarkName } from './landmarks';

export type PoseName = 'arabesque' | 'attitude-derriere' | 'retire-passe';
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

export interface Landmark {
  name: LandmarkName;
  x: number;
  y: number;
  z?: number;
  visibility: number;
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

export interface FullBodySection {
  region: BodyRegion;
  status: 'finding' | 'clear' | 'unassessable';
  items: readonly FeedbackItem[];
}

export interface AnalysisResult {
  sessionId: string;
  position: PoseName;
  landmarks: readonly Landmark[];
  topCorrections: readonly FeedbackItem[];
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
    id: crypto.randomUUID(),
    position,
    supportingSide,
    expectedViews: [view],
    frames: [],
    status: 'select',
    createdAt,
  };
}

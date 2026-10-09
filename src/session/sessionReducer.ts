import type { AnalysisResult, PoseName, SupportingSide } from '../domain/types';
import type { QualityReport } from '../quality/types';

export type Stage = 'select' | 'frame' | 'check' | 'result';

export interface ImageSelection {
  file: File;
  previewUrl: string;
}

export interface SessionState {
  stage: Stage;
  unlockedStages: ReadonlySet<Stage>;
  position: PoseName | null;
  supportingSide: SupportingSide | null;
  image: ImageSelection | null;
  quality: QualityReport | null;
  result: AnalysisResult | null;
  error: string | null;
}

export type SessionAction =
  | { type: 'selection-confirmed'; position: PoseName; supportingSide: SupportingSide }
  | { type: 'position-changed'; position: PoseName }
  | { type: 'supporting-side-changed'; supportingSide: SupportingSide }
  | { type: 'image-selected'; image: ImageSelection }
  | { type: 'quality-completed'; report: QualityReport }
  | { type: 'analysis-succeeded'; result: AnalysisResult }
  | { type: 'analysis-failed'; message: string }
  | { type: 'stage-requested'; stage: Stage }
  | { type: 'reset' };

export const initialSessionState: SessionState = {
  stage: 'select',
  unlockedStages: new Set(['select']),
  position: null,
  supportingSide: null,
  image: null,
  quality: null,
  result: null,
  error: null,
};

const TRANSITIONS: Record<Exclude<SessionAction['type'], 'stage-requested' | 'reset'>, Stage> = {
  'selection-confirmed': 'frame',
  'position-changed': 'select',
  'supporting-side-changed': 'select',
  'image-selected': 'check',
  'quality-completed': 'check',
  'analysis-succeeded': 'result',
  'analysis-failed': 'check',
};

const unlockedThrough = (stage: Stage): ReadonlySet<Stage> => {
  const stages: Stage[] = ['select', 'frame', 'check', 'result'];
  return new Set(stages.slice(0, stages.indexOf(stage) + 1));
};

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'selection-confirmed':
      return {
        ...initialSessionState,
        stage: TRANSITIONS[action.type],
        unlockedStages: unlockedThrough(TRANSITIONS[action.type]),
        position: action.position,
        supportingSide: action.supportingSide,
      };
    case 'position-changed':
      return {
        ...initialSessionState,
        stage: TRANSITIONS[action.type],
        position: action.position,
        supportingSide: state.supportingSide,
      };
    case 'supporting-side-changed':
      return {
        ...initialSessionState,
        stage: TRANSITIONS[action.type],
        position: state.position,
        supportingSide: action.supportingSide,
      };
    case 'image-selected':
      return {
        ...state,
        stage: TRANSITIONS[action.type],
        unlockedStages: unlockedThrough(TRANSITIONS[action.type]),
        image: action.image,
        quality: null,
        result: null,
        error: null,
      };
    case 'quality-completed':
      return { ...state, stage: TRANSITIONS[action.type], quality: action.report, error: null };
    case 'analysis-succeeded':
      return {
        ...state,
        stage: TRANSITIONS[action.type],
        unlockedStages: unlockedThrough(TRANSITIONS[action.type]),
        result: action.result,
        error: null,
      };
    case 'analysis-failed':
      return { ...state, stage: TRANSITIONS[action.type], error: action.message };
    case 'stage-requested':
      return state.unlockedStages.has(action.stage) ? { ...state, stage: action.stage } : state;
    case 'reset':
      return initialSessionState;
  }
}

import type { LandmarkName } from '../domain/landmarks';
import type { BodyRegion, Landmark, LandmarkReliabilityMap, MeasurementSet, Observation, PoseName, Priority, SupportingSide, ViewType } from '../domain/types';

export interface RuleContext {
  position: PoseName;
  supportingSide: SupportingSide;
  /** Present only after the framing check has confirmed the camera view. */
  view?: ViewType | undefined;
  landmarks: readonly Landmark[];
  reliability: LandmarkReliabilityMap;
  measurements: MeasurementSet;
}

export interface Rule {
  id: string;
  dedupeKey: string;
  positions: readonly PoseName[];
  supportedViews?: readonly ViewType[];
  requiredMeasurements: readonly (keyof MeasurementSet)[];
  region?: BodyRegion;
  priority?: Priority;
  evidence?: readonly LandmarkName[];
  evaluate(context: RuleContext): Observation | null;
}

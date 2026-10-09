import { measurePose } from '../../src/analysis/measurePose';
import type { Landmark, MeasurementSet, SupportingSide, ViewType } from '../../src/domain/types';
import { evaluateLandmarkReliability } from '../../src/reliability/evaluateLandmarkReliability';

export type MeasurementValueOverrides = Partial<Record<keyof MeasurementSet, number>>;

export function measuredPose(
  landmarks: readonly Landmark[],
  supportingSide: SupportingSide,
  view: ViewType,
  overrides: MeasurementValueOverrides = {},
) {
  const reliability = evaluateLandmarkReliability(landmarks, view);
  const measurements = { ...measurePose(landmarks, supportingSide, reliability, view, 1, 1) };
  for (const [key, value] of Object.entries(overrides) as [keyof MeasurementSet, number][]) {
    measurements[key] = {
      ...measurements[key],
      value,
      assessability: 'assessable',
    };
  }
  return { reliability, measurements };
}

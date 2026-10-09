import type { AnalysisResult } from '../src/domain/types';
import type { CorrectionLabel } from './dataset.schema';
import { directionCodeForRule } from './directionCodes';

/** Extracts the rule-owned direction codes; it never derives them from display copy. */
export function actualTop3FromAnalysisResult(result: AnalysisResult): readonly CorrectionLabel[] {
  return result.topCorrections.map(({ region, ruleId }) => ({ region, direction: directionCodeForRule(ruleId) }));
}

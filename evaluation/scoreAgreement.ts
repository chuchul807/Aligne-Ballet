import type { LabelledCase } from './dataset.schema';

export interface AgreementReport {
  assessableCount: number;
  matchedCount: number;
  rate: number;
  passesTarget: boolean;
  unassessableCount: number;
  correctlyRejectedCount: number;
  qualityGateRate: number | null;
}

const MINIMUM_MATCHES = 2;
const RELEASE_TARGET = 0.8;

export function normalizeDirection(direction: string): string {
  return direction.trim().toLowerCase().replace(/[\s_]+/g, '-');
}

function correctionKey(correction: LabelledCase['expectedTop3'][number]): string {
  return `${correction.region}:${normalizeDirection(correction.direction)}`;
}

function hasRequiredMatches(caseRecord: LabelledCase): boolean {
  const expected = new Set(caseRecord.expectedTop3.map(correctionKey));
  const actual = new Set(caseRecord.actualTop3.map(correctionKey));
  return [...actual].filter((key) => expected.has(key)).length >= MINIMUM_MATCHES;
}

/** Scores region-plus-direction agreement for a pre-labelled real-photo evaluation set. */
export function scoreAgreement(cases: readonly LabelledCase[]): AgreementReport {
  const assessable = cases.filter((caseRecord) => caseRecord.assessable);
  const unassessable = cases.filter((caseRecord) => !caseRecord.assessable);
  const matchedCount = assessable.filter(hasRequiredMatches).length;
  const correctlyRejectedCount = unassessable.filter((caseRecord) => caseRecord.actualTop3.length === 0).length;
  const rate = assessable.length === 0 ? 0 : matchedCount / assessable.length;

  return {
    assessableCount: assessable.length,
    matchedCount,
    rate,
    passesTarget: assessable.length > 0 && rate >= RELEASE_TARGET,
    unassessableCount: unassessable.length,
    correctlyRejectedCount,
    qualityGateRate: unassessable.length === 0 ? null : correctlyRejectedCount / unassessable.length,
  };
}

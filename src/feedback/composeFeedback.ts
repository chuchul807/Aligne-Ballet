import type { BodyRegion, CorrectionFeedbackItem, FeedbackItem, FullBodySection, Observation, Priority } from '../domain/types';
import { deduplicateObservations } from '../rules/deduplicateObservations';
import { feedbackCopyFor } from './copy';

export type AssessmentCoverage = Readonly<Record<BodyRegion, 'assessable' | 'unassessable'>>;

export interface FeedbackSummary {
  topCorrections: readonly CorrectionFeedbackItem[];
  fullBodyReview: readonly FullBodySection[];
}

const BODY_REGIONS: readonly BodyRegion[] = [
  'supporting-leg', 'working-leg', 'pelvis', 'torso', 'shoulders-arms', 'head', 'feet',
];

const PRIORITY_ORDER: Readonly<Record<Priority, number>> = {
  stability: 0,
  structure: 1,
  line: 2,
};

const CLEAR_TEXT = 'No visible issue found in this view.';
const UNASSESSABLE_TEXT = 'Unable to assess this area reliably because the joint may be obscured or inconsistent.';
export const INSUFFICIENT_EVIDENCE_TEXT = 'Not enough evidence in this photo to recommend a change.';

function isActionable(observation: Observation): observation is Extract<Observation, { assessability: 'assessable' }> & { confidence: 'high' } {
  return observation.assessability === 'assessable' && observation.confidence === 'high';
}

function toFeedbackItem(observation: Extract<Observation, { assessability: 'assessable' }> & { confidence: 'high' }): CorrectionFeedbackItem {
  return {
    observationId: observation.id,
    ruleId: observation.ruleId,
    text: feedbackCopyFor(observation.ruleId, observation.confidence),
    region: observation.region,
    priority: observation.priority,
    confidence: observation.confidence,
    direction: observation.direction,
  };
}

function compareObservations(left: Observation, right: Observation): number {
  const priority = PRIORITY_ORDER[left.priority] - PRIORITY_ORDER[right.priority];
  if (priority !== 0) return priority;
  const severity = (right.severity ?? Number.NEGATIVE_INFINITY) - (left.severity ?? Number.NEGATIVE_INFINITY);
  if (severity !== 0) return severity;
  return left.ruleId.localeCompare(right.ruleId);
}

export function composeFeedback(
  observations: readonly Observation[],
  coverage: AssessmentCoverage,
): FeedbackSummary {
  const deduplicated = deduplicateObservations(observations);
  const actionable = deduplicated
    .filter(isActionable)
    .filter((observation) => coverage[observation.region] === 'assessable')
    .sort(compareObservations);
  const itemsByRegion = new Map<BodyRegion, readonly FeedbackItem[]>();

  for (const region of BODY_REGIONS) {
    itemsByRegion.set(region, actionable.filter((observation) => observation.region === region).map(toFeedbackItem));
  }

  return {
    topCorrections: actionable.slice(0, 3).map(toFeedbackItem),
    fullBodyReview: BODY_REGIONS.map((region) => {
      if (coverage[region] === 'unassessable') {
        return { region, status: 'unassessable', items: [{ observationId: `coverage-${region}`, text: UNASSESSABLE_TEXT, region, priority: 'line', confidence: 'medium' }] };
      }
      const items = itemsByRegion.get(region) ?? [];
      if (items.length > 0) return { region, status: 'finding', items };
      const hasInsufficientEvidence = deduplicated.some((observation) => (
        observation.region === region
        && (observation.assessability === 'unassessable' || observation.confidence !== 'high')
      ));
      return hasInsufficientEvidence
        ? { region, status: 'unassessable', items: [{ observationId: `insufficient-${region}`, text: INSUFFICIENT_EVIDENCE_TEXT, region, priority: 'line', confidence: 'medium' }] }
        : { region, status: 'clear', items: [{ observationId: `clear-${region}`, text: CLEAR_TEXT, region, priority: 'line', confidence: 'high' }] };
    }),
  };
}

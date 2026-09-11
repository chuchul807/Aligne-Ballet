import type { Observation } from '../domain/types';

const confidenceRank = { low: 0, medium: 1, high: 2 } as const;
const priorityOrder = { stability: 0, structure: 1, line: 2 } as const;

function compareCandidates(left: Observation, right: Observation): number {
  if (left.assessability !== right.assessability) {
    return left.assessability === 'assessable' ? -1 : 1;
  }
  const confidence = confidenceRank[right.confidence] - confidenceRank[left.confidence];
  if (confidence !== 0) return confidence;
  const priority = priorityOrder[left.priority] - priorityOrder[right.priority];
  if (priority !== 0) return priority;
  if (left.severity !== right.severity) {
    return (right.severity ?? Number.NEGATIVE_INFINITY)
      - (left.severity ?? Number.NEGATIVE_INFINITY);
  }
  return left.ruleId.localeCompare(right.ruleId);
}

export function deduplicateObservations(observations: readonly Observation[]): readonly Observation[] {
  const winnerByKey = new Map<string, { observation: Observation; index: number }>();
  observations.forEach((observation, index) => {
    const winner = winnerByKey.get(observation.dedupeKey);
    if (!winner || compareCandidates(observation, winner.observation) < 0) {
      winnerByKey.set(observation.dedupeKey, { observation, index });
    }
  });
  return [...winnerByKey.values()]
    .sort((left, right) => left.index - right.index)
    .map(({ observation }) => observation);
}

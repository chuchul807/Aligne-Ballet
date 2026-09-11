import type { Confidence, Observation, PoseMeasurement } from '../domain/types';
import type { Rule, RuleContext } from './types';

const confidenceRank: Record<Confidence, number> = { low: 0, medium: 1, high: 2 };

function lowestConfidence(values: readonly Confidence[]): Confidence {
  return values.reduce<Confidence>((lowest, value) => (
    confidenceRank[value] < confidenceRank[lowest] ? value : lowest
  ), 'high');
}

function isUsable(measurement: PoseMeasurement): boolean {
  return measurement.assessability === 'assessable'
    && measurement.value !== null
    && Number.isFinite(measurement.value);
}

function unassessable(rule: Rule): Observation {
  return {
    id: rule.id,
    ruleId: rule.id,
    dedupeKey: rule.dedupeKey,
    region: rule.region ?? 'torso',
    priority: rule.priority ?? 'structure',
    confidence: 'low',
    evidence: rule.evidence ?? [],
    annotation: [],
    assessability: 'unassessable',
    issue: null,
    action: null,
    direction: null,
    severity: null,
  };
}

function normaliseObservation(
  observation: Observation,
  rule: Rule,
  context: RuleContext,
): Observation {
  if (observation.assessability === 'unassessable') {
    return { ...observation, dedupeKey: rule.dedupeKey, confidence: 'low' };
  }
  const measurementConfidence = rule.requiredMeasurements
    .map((name) => context.measurements[name].confidence);
  const evidenceConfidence = observation.evidence
    .map((name) => context.reliability.get(name as import('../domain/landmarks').LandmarkName)?.confidence ?? 'low');
  return {
    ...observation,
    dedupeKey: rule.dedupeKey,
    confidence: lowestConfidence([...measurementConfidence, ...evidenceConfidence]),
    severity: Number.isFinite(observation.severity)
      ? Math.min(1, Math.max(0, observation.severity))
      : 0,
  };
}

export function evaluateRules(rules: readonly Rule[], context: RuleContext): readonly Observation[] {
  return rules.flatMap((rule) => {
    if (!rule.positions.includes(context.position)) return [];
    if (rule.supportedViews && (!context.view || !rule.supportedViews.includes(context.view))) {
      return [unassessable(rule)];
    }
    if (rule.requiredMeasurements.some((name) => !isUsable(context.measurements[name]))) {
      return [unassessable(rule)];
    }
    const observation = rule.evaluate(context);
    return observation ? [normaliseObservation(observation, rule, context)] : [];
  });
}

import type { Confidence, Landmark, Observation } from '../domain/types';
import type { Rule, RuleContext } from './types';

function confidenceFor(evidence: readonly string[], landmarks: readonly Landmark[]): Confidence {
  const visible = new Map<string, number>(landmarks.map((landmark) => [landmark.name, landmark.visibility]));
  const values = evidence.map((name) => visible.get(name));
  if (values.length > 0 && values.every((value) => value !== undefined && value >= 0.8)) return 'high';
  if (values.length > 0 && values.every((value) => value !== undefined && value >= 0.6)) return 'medium';
  return 'low';
}

function unassessable(rule: Rule): Observation {
  return {
    id: rule.id,
    ruleId: rule.id,
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

function normaliseObservation(observation: Observation, landmarks: readonly Landmark[]): Observation {
  if (observation.assessability === 'unassessable') return { ...observation, confidence: 'low' };
  return {
    ...observation,
    confidence: confidenceFor(observation.evidence, landmarks),
    severity: Math.min(1, Math.max(0, observation.severity)),
  };
}

export function evaluateRules(rules: readonly Rule[], context: RuleContext): readonly Observation[] {
  return rules.flatMap((rule) => {
    if (!rule.positions.includes(context.position)) return [];
    if (rule.requiredMeasurements.some((measurement) => context.measurements[measurement] === null)) {
      return [unassessable(rule)];
    }
    const observation = rule.evaluate(context);
    return observation ? [normaliseObservation(observation, context.landmarks)] : [];
  });
}

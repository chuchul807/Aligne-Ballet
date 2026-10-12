import { describe, expect, it } from 'vitest';
import type { Landmark } from '../domain/types';
import type { LandmarkName } from '../domain/landmarks';
import { mirroredPerson, landmarkPerson } from '../../tests/builders/landmarks';
import { measurePose } from '../analysis/measurePose';
import { buildAnnotationCommands } from '../annotation/buildCommands';
import { composeFeedback } from '../feedback/composeFeedback';
import { COMMON_RULES } from '../rules/commonRules';
import { evaluateRules } from '../rules/evaluateRules';
import { RETIRE_RULES } from '../rules/retireRules';
import { evaluateLandmarkReliability } from './evaluateLandmarkReliability';

const allRegionsAssessable = {
  'supporting-leg': 'assessable', 'working-leg': 'assessable', pelvis: 'assessable',
  torso: 'assessable', 'shoulders-arms': 'assessable', head: 'assessable', feet: 'assessable',
} as const;

function conservativeOutputs(
  landmarks: readonly Landmark[],
  rules = COMMON_RULES,
) {
  const reliability = evaluateLandmarkReliability(landmarks, 'front');
  const measurements = measurePose(landmarks, 'left', reliability, 'front', 1, 1);
  const observations = evaluateRules(rules, {
    position: 'retire-passe', supportingSide: 'left', view: 'front', landmarks, reliability, measurements,
  });
  return {
    reliability,
    observations,
    feedback: composeFeedback(observations, allRegionsAssessable),
    commands: buildAnnotationCommands(
      observations.filter((item) => item.assessability === 'assessable'),
      landmarks,
      reliability,
      'left',
    ),
  };
}

function overlapPair(
  person: readonly Landmark[],
  first: LandmarkName,
  second: LandmarkName,
): readonly Landmark[] {
  const target = person.find((point) => point.name === second)!;
  return person.map((point) => point.name === first
    ? { ...point, x: target.x, y: target.y }
    : point);
}

function update(
  landmarks: readonly Landmark[],
  name: LandmarkName,
  changes: Partial<Landmark>,
): readonly Landmark[] {
  return landmarks.map((point) => point.name === name ? { ...point, ...changes } : point);
}

describe('evaluateLandmarkReliability', () => {
  it('marks a visible plausible supporting chain assessable', () => {
    const result = evaluateLandmarkReliability(landmarkPerson(), 'front');

    expect(result.get('left_knee')).toMatchObject({
      assessability: 'assessable', confidence: 'high', reasons: [],
    });
  });

  it('rejects defined presence below 0.60 without rejecting absent presence', () => {
    const low = update(landmarkPerson(), 'left_knee', { presence: 0.59 });

    expect(evaluateLandmarkReliability(low, 'front').get('left_knee')?.reasons).toContain('low-presence');
    expect(evaluateLandmarkReliability(landmarkPerson(), 'front').get('left_knee')?.assessability).toBe('assessable');
  });

  it('marks a cross-pass disagreement unassessable', () => {
    const result = evaluateLandmarkReliability(
      landmarkPerson(), 'front', new Set<LandmarkName>(['left_knee']),
    );

    expect(result.get('left_knee')).toMatchObject({
      assessability: 'unassessable',
      confidence: 'low',
      reasons: expect.arrayContaining(['cross-pass-disagreement']),
    });
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'rejects non-finite presence %s instead of treating it as absent',
    (presence) => {
      const landmarks = update(landmarkPerson(), 'left_knee', { presence });

      expect(evaluateLandmarkReliability(landmarks, 'front').get('left_knee')).toMatchObject({
        assessability: 'unassessable', confidence: 'low', reasons: ['low-presence'],
      });
    },
  );

  it('rejects a high-visibility knee whose leg-chain proportions are implausible', () => {
    const displaced = landmarkPerson().map((point) => point.name === 'left_knee'
      ? { ...point, x: 0.95, visibility: 0.99 }
      : point);

    expect(evaluateLandmarkReliability(displaced, 'front').get('left_knee')).toMatchObject({
      assessability: 'unassessable',
      reasons: expect.arrayContaining(['implausible-chain']),
    });
  });

  it.each([
    ['ankle', 'left_ankle', ['left_knee', 'left_ankle']],
    ['wrist', 'left_wrist', ['left_elbow', 'left_wrist']],
  ] as const)('propagates displaced %s ambiguity across its measurement chain', (_label, displacedName, chain) => {
    const displaced = landmarkPerson().map((point) => point.name === displacedName
      ? { ...point, x: 0.95, y: 0.5, visibility: 0.99 }
      : point);
    const { reliability, feedback, commands } = conservativeOutputs(displaced);

    for (const name of chain) {
      expect(reliability.get(name)).toMatchObject({
        assessability: 'unassessable',
        reasons: expect.arrayContaining(['implausible-chain']),
      });
      expect(commands).not.toContainEqual(expect.objectContaining({ type: 'structural-joint', joint: name }));
    }
    expect(feedback.topCorrections.some((item) => item.region === (_label === 'wrist' ? 'shoulders-arms' : 'supporting-leg'))).toBe(false);
  });

  it('suppresses a ratio-only supporting-ankle ambiguity from real Retiré feedback and overlays', () => {
    const displaced = landmarkPerson().map((point) => {
      if (point.name === 'left_ankle') return { ...point, x: 0.55, y: 0.43, visibility: 0.99 };
      if (point.name === 'left_heel') return { ...point, x: 0.57, y: 0.45, visibility: 0.99 };
      if (point.name === 'left_foot_index') return { ...point, x: 0.59, y: 0.47, visibility: 0.99 };
      return point;
    });
    const torso = 0.4;
    const hip = displaced.find((point) => point.name === 'left_hip')!;
    const knee = displaced.find((point) => point.name === 'left_knee')!;
    const ankle = displaced.find((point) => point.name === 'left_ankle')!;
    const upper = Math.hypot(hip.x - knee.x, hip.y - knee.y);
    const lower = Math.hypot(knee.x - ankle.x, knee.y - ankle.y);

    expect(upper / lower).toBeLessThan(0.35);
    expect(Math.max(upper, lower)).toBeLessThanOrEqual(1.25 * torso);

    const { reliability, observations, feedback, commands } = conservativeOutputs(displaced, [...COMMON_RULES, ...RETIRE_RULES]);
    expect(reliability.get('left_ankle')).toMatchObject({
      assessability: 'unassessable',
      reasons: expect.arrayContaining(['implausible-chain']),
    });
    expect(observations.find((item) => item.ruleId === 'supporting-lateral-offset'))
      .toMatchObject({ assessability: 'unassessable' });
    expect(feedback.topCorrections.some((item) => item.ruleId === 'supporting-lateral-offset')).toBe(false);
    expect(commands).not.toContainEqual(expect.objectContaining({ type: 'structural-joint', joint: 'left_ankle' }));
    expect(commands.some((item) => item.type === 'skeleton-segment'
      && (item.from === 'left_ankle' || item.to === 'left_ankle'))).toBe(false);
  });

  it('suppresses a ratio-only working-ankle ambiguity from the Retiré foot rule and overlay', () => {
    const displaced = landmarkPerson().map((point) => {
      if (point.name === 'right_ankle') return { ...point, x: 0.85, y: 0.43, visibility: 0.99 };
      if (point.name === 'right_heel') return { ...point, x: 0.87, y: 0.45, visibility: 0.99 };
      if (point.name === 'right_foot_index') return { ...point, x: 0.89, y: 0.47, visibility: 0.99 };
      return point;
    });
    const { reliability, observations, feedback, commands } = conservativeOutputs(displaced, [...COMMON_RULES, ...RETIRE_RULES]);

    expect(reliability.get('right_ankle')).toMatchObject({
      assessability: 'unassessable',
      reasons: expect.arrayContaining(['implausible-chain']),
    });
    expect(observations.find((item) => item.ruleId === 'retire-place-foot-at-knee'))
      .toMatchObject({ assessability: 'unassessable' });
    expect(feedback.topCorrections.some((item) => item.ruleId === 'retire-place-foot-at-knee')).toBe(false);
    expect(commands).not.toContainEqual(expect.objectContaining({ type: 'structural-joint', joint: 'right_ankle' }));
  });

  it.each([
    ['wrist', 'left_wrist', { x: 0.68, y: 0.60 }, ['left_shoulder', 'left_elbow', 'left_wrist']],
    ['toe', 'left_foot_index', { x: 0.10, y: 0.75 }, ['left_ankle', 'left_heel', 'left_foot_index']],
  ] as const)('invalidates a ratio-only displaced %s endpoint without an absolute-cap failure', (_label, displacedName, location, chain) => {
    const displaced = landmarkPerson().map((point) => point.name === displacedName
      ? { ...point, ...location, visibility: 0.99 }
      : point);
    const first = displaced.find((point) => point.name === chain[0])!;
    const middle = displaced.find((point) => point.name === chain[1])!;
    const last = displaced.find((point) => point.name === chain[2])!;
    const firstSegment = Math.hypot(first.x - middle.x, first.y - middle.y);
    const secondSegment = Math.hypot(middle.x - last.x, middle.y - last.y);

    expect(firstSegment / secondSegment).toBeLessThan(0.35);
    expect(Math.max(firstSegment, secondSegment)).toBeLessThanOrEqual(1.25 * 0.4);

    const { reliability, commands } = conservativeOutputs(displaced);

    expect(reliability.get(displacedName)).toMatchObject({
      assessability: 'unassessable',
      reasons: expect.arrayContaining(['implausible-chain']),
    });
    expect(commands).not.toContainEqual(expect.objectContaining({ type: 'structural-joint', joint: displacedName }));
    expect(commands.some((item) => item.type === 'skeleton-segment'
      && (item.from === displacedName || item.to === displacedName))).toBe(false);
  });

  it.each(['left_heel', 'left_foot_index'] as const)(
    'suppresses a displaced %s and the ambiguous attached foot chain from the overlay',
    (displacedName) => {
      const displaced = landmarkPerson().map((point) => point.name === displacedName
        ? { ...point, x: 0.95, y: 0.5, visibility: 0.99 }
        : point);
      const { reliability, feedback, commands } = conservativeOutputs(displaced);

      expect(reliability.get(displacedName)?.assessability).toBe('unassessable');
      expect(commands).not.toContainEqual(expect.objectContaining({ type: 'structural-joint', joint: displacedName }));
      expect(commands.some((item) => item.type === 'skeleton-segment'
        && (item.from === displacedName || item.to === displacedName))).toBe(false);
      expect(feedback.topCorrections.some((item) => item.region === 'feet')).toBe(false);
    },
  );

  it('rejects a collapsed arm chain with a non-finite segment ratio', () => {
    const collapsed = landmarkPerson().map((point) => (
      point.name === 'left_shoulder' || point.name === 'left_elbow' || point.name === 'left_wrist'
        ? { ...point, x: 0.4, y: 0.3 }
        : point
    ));

    expect(evaluateLandmarkReliability(collapsed, 'front').get('left_elbow')).toMatchObject({
      assessability: 'unassessable',
      reasons: expect.arrayContaining(['implausible-chain']),
    });
  });

  it('marks overlapping same-joint sides ambiguous without changing unrelated joints', () => {
    const overlapped = overlapPair(landmarkPerson(), 'left_wrist', 'right_wrist');
    const result = evaluateLandmarkReliability(overlapped, 'three-quarter-side');

    expect(result.get('left_wrist')?.reasons).toContain('possible-occlusion');
    expect(result.get('left_hip')?.assessability).toBe('assessable');
  });

  it('returns the same semantic reliability after left-right mirroring', () => {
    const left = evaluateLandmarkReliability(landmarkPerson(), 'front');
    const right = evaluateLandmarkReliability(mirroredPerson(landmarkPerson()), 'front');

    expect(right.get('right_knee')?.assessability).toBe(left.get('left_knee')?.assessability);
  });
});

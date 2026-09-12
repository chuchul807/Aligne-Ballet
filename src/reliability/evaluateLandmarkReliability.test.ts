import { describe, expect, it } from 'vitest';
import type { Landmark } from '../domain/types';
import type { LandmarkName } from '../domain/landmarks';
import { mirroredPerson, landmarkPerson } from '../../tests/builders/landmarks';
import { measurePose } from '../analysis/measurePose';
import { buildAnnotationCommands } from '../annotation/buildCommands';
import { composeFeedback } from '../feedback/composeFeedback';
import { COMMON_RULES } from '../rules/commonRules';
import { evaluateRules } from '../rules/evaluateRules';
import { evaluateLandmarkReliability } from './evaluateLandmarkReliability';

const allRegionsAssessable = {
  'supporting-leg': 'assessable', 'working-leg': 'assessable', pelvis: 'assessable',
  torso: 'assessable', 'shoulders-arms': 'assessable', head: 'assessable', feet: 'assessable',
} as const;

function conservativeOutputs(landmarks: readonly Landmark[]) {
  const reliability = evaluateLandmarkReliability(landmarks, 'front');
  const measurements = measurePose(landmarks, 'left', reliability, 'front');
  const observations = evaluateRules(COMMON_RULES, {
    position: 'retire-passe', supportingSide: 'left', view: 'front', landmarks, reliability, measurements,
  });
  return {
    reliability,
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

describe('evaluateLandmarkReliability', () => {
  it('marks a visible plausible supporting chain assessable', () => {
    const result = evaluateLandmarkReliability(landmarkPerson(), 'front');

    expect(result.get('left_knee')).toMatchObject({
      assessability: 'assessable', confidence: 'high', reasons: [],
    });
  });

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

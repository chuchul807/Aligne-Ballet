import { describe, expect, it } from 'vitest';
import type { Landmark } from '../domain/types';
import type { LandmarkName } from '../domain/landmarks';
import { mirroredPerson, landmarkPerson } from '../../tests/builders/landmarks';
import { evaluateLandmarkReliability } from './evaluateLandmarkReliability';

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

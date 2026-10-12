import { describe, expect, it } from 'vitest';
import { landmarkNames } from '../domain/landmarks';
import { mapMediaPipeResult, POSE_MODEL_ASSET_PATH } from './MediaPipePoseDetector';

function fakePerson(visibility: number) {
  return landmarkNames.map((_, index) => ({
    x: index / 100,
    y: index / 200,
    z: -index / 300,
    visibility,
    presence: 0.88,
  }));
}

describe('MediaPipe model configuration', () => {
  it('uses the Heavy pose model asset', () => {
    expect(POSE_MODEL_ASSET_PATH).toBe('/models/pose_landmarker_heavy.task');
  });
});

describe('mapMediaPipeResult', () => {
  it.each([
    ['omitted', {}],
    ['NaN', { presence: Number.NaN }],
    ['Infinity', { presence: Number.POSITIVE_INFINITY }],
    ['-Infinity', { presence: Number.NEGATIVE_INFINITY }],
  ] as const)('omits %s optional presence while preserving required landmark evidence', (_label, presence) => {
    const person = fakePerson(0.93).map(({ presence: _presence, ...landmark }) => ({
      ...landmark, ...presence,
    }));
    const mapped = mapMediaPipeResult({ landmarks: [person] }, 1080, 1920);
    const knee = mapped.people[0]?.find((point) => point.name === 'left_knee');

    expect(knee).not.toHaveProperty('presence');
    expect(knee).toMatchObject({ x: 0.25, y: 0.125, visibility: 0.93 });
  });

  it('maps every detected person to named landmarks', () => {
    const mapped = mapMediaPipeResult({
      landmarks: [fakePerson(0.93), fakePerson(0.71)],
    }, 1080, 1920);

    expect(mapped).toMatchObject({ sourceWidth: 1080, sourceHeight: 1920 });
    expect(mapped.people).toHaveLength(2);
    expect(mapped.people[0]?.map((point) => point.name)).toEqual(landmarkNames);
    expect(mapped.people[0]?.find((point) => point.name === 'left_knee')).toMatchObject({
      x: 0.25,
      y: 0.125,
      z: -0.08333333333333333,
      visibility: 0.93,
      presence: 0.88,
    });
    expect(mapped.people[1]?.find((point) => point.name === 'left_knee')).toMatchObject({ visibility: 0.71 });
  });
});

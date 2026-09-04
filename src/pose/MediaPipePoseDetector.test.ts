import { describe, expect, it } from 'vitest';
import { landmarkNames } from '../domain/landmarks';
import { mapMediaPipeResult } from './MediaPipePoseDetector';

function fakePerson(visibility: number) {
  return landmarkNames.map((_, index) => ({
    x: index / 100,
    y: index / 200,
    z: -index / 300,
    visibility,
  }));
}

describe('mapMediaPipeResult', () => {
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
    });
    expect(mapped.people[1]?.find((point) => point.name === 'left_knee')).toMatchObject({ visibility: 0.71 });
  });
});

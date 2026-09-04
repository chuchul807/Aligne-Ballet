import { describe, expect, it } from 'vitest';
import { measurePose } from './measurePose';
import { landmarkPerson, mirroredPerson } from '../../tests/builders/landmarks';

describe('measurePose', () => {
  it('normalises measurements and mirrors supporting-side semantics', () => {
    const left = measurePose(landmarkPerson(), 'left');
    const right = measurePose(mirroredPerson(landmarkPerson()), 'right');

    expect(left.torsoLength).toBeCloseTo(0.4, 5);
    for (const key of Object.keys(left) as (keyof typeof left)[]) {
      const leftValue = left[key];
      const rightValue = right[key];
      if (leftValue === null) expect(rightValue).toBeNull();
      else expect(rightValue).toBeCloseTo(leftValue, 5);
    }
  });

  it('keeps an unavailable measurement null when a required landmark is absent', () => {
    const measurements = measurePose(landmarkPerson().filter((point) => point.name !== 'left_ankle'), 'left');

    expect(measurements.supportingKneeAngle).toBeNull();
    expect(measurements.supportingAnkleUnderHipOffset).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import type { Landmark } from '../domain/types';
import type { LandmarkName } from '../domain/landmarks';
import { landmarkNames } from '../domain/landmarks';
import { comparePosePasses } from './poseAgreement';

const point = (name: LandmarkName, x: number, y: number, extra: Partial<Landmark> = {}): Landmark => ({
  name,
  x,
  y,
  visibility: 0.9,
  ...extra,
});

function landmarkPerson(): Landmark[] {
  return landmarkNames.map((name, index) => point(name, 0.3 + (index % 3) * 0.2, name.includes('shoulder') ? 0.3 : name.includes('hip') ? 0.7 : 0.5));
}

function move(landmarks: readonly Landmark[], name: LandmarkName, dx: number): Landmark[] {
  return landmarks.map((landmark) => landmark.name === name ? { ...landmark, x: landmark.x + dx } : landmark);
}

function without(landmarks: readonly Landmark[], name: LandmarkName): Landmark[] {
  return landmarks.filter((landmark) => landmark.name !== name);
}

function update(landmarks: readonly Landmark[], name: LandmarkName, patch: Partial<Landmark>): Landmark[] {
  return landmarks.map((landmark) => landmark.name === name ? { ...landmark, ...patch } : landmark);
}

describe('cross-pass pose agreement', () => {
  it('rejects a knee beyond 0.12 torso lengths', () => {
    const refined = move(landmarkPerson(), 'left_knee', 0.049);
    expect(comparePosePasses(landmarkPerson(), refined, 1000, 1000)).toContain('left_knee');
  });

  it('keeps a wrist within 0.18 torso lengths', () => {
    const refined = move(landmarkPerson(), 'left_wrist', 0.070);
    expect(comparePosePasses(landmarkPerson(), refined, 1000, 1000)).not.toContain('left_wrist');
  });

  it.each([
    ['missing', without(landmarkPerson(), 'right_hip')],
    ['low visibility', update(landmarkPerson(), 'right_hip', { visibility: 0.59 })],
    ['low presence', update(landmarkPerson(), 'right_hip', { presence: 0.59 })],
  ] as const)('marks %s cross-pass evidence unstable', (_label, whole) => {
    expect(comparePosePasses(whole, landmarkPerson(), 1000, 1000)).toContain('right_hip');
  });

  it('marks a foot unstable when heel-to-toe depth order flips between passes', () => {
    const withDepth = (heel: number, toe: number) => landmarkPerson().map((landmark) => {
      if (landmark.name === 'right_heel') return { ...landmark, z: heel };
      if (landmark.name === 'right_foot_index') return { ...landmark, z: toe };
      return { ...landmark, z: 0 };
    });

    const unstable = comparePosePasses(withDepth(-0.04, 0.04), withDepth(0.04, -0.04), 1000, 1000);

    expect(unstable).toContain('right_heel');
    expect(unstable).toContain('right_foot_index');
  });

  it('marks a knee unstable when its forward-versus-behind depth cue flips between passes', () => {
    const withKneeDepth = (kneeDepth: number) => landmarkPerson().map((landmark) => ({
      ...landmark,
      z: landmark.name === 'left_knee' ? kneeDepth : 0,
    }));

    const unstable = comparePosePasses(withKneeDepth(-0.05), withKneeDepth(0.05), 1000, 1000);

    expect(unstable).toContain('left_knee');
  });

  it('keeps near-zero knee-depth noise inside the straight-leg deadband', () => {
    const withKneeDepth = (kneeDepth: number) => landmarkPerson().map((landmark) => ({
      ...landmark,
      z: landmark.name === 'left_knee' ? kneeDepth : 0,
    }));

    expect(comparePosePasses(withKneeDepth(0), withKneeDepth(-0.001), 1000, 1000))
      .not.toContain('left_knee');
    expect(comparePosePasses(withKneeDepth(-0.001), withKneeDepth(0.001), 1000, 1000))
      .not.toContain('left_knee');
  });

  it('keeps materially forward knee-depth cues stable when both passes agree', () => {
    const withKneeDepth = (kneeDepth: number) => landmarkPerson().map((landmark) => ({
      ...landmark,
      z: landmark.name === 'left_knee' ? kneeDepth : 0,
    }));

    expect(comparePosePasses(withKneeDepth(-0.05), withKneeDepth(-0.06), 1000, 1000))
      .not.toContain('left_knee');
  });

  it('marks a knee unstable when only one pass has its depth evidence', () => {
    const withDepth = landmarkPerson().map((landmark) => ({ ...landmark, z: 0 }));
    const missingKneeDepth = withDepth.map((landmark) => {
      if (landmark.name !== 'left_knee') return landmark;
      const { z: _z, ...withoutDepth } = landmark;
      return withoutDepth;
    });

    expect(comparePosePasses(withDepth, missingKneeDepth, 1000, 1000)).toContain('left_knee');
  });

  describe.each([
    ['landscape', 2000, 1000],
    ['portrait', 1000, 2000],
  ] as const)('%s source pixels', (_label, width, height) => {
    describe.each(['vertical', 'horizontal'] as const)('%s torso', (orientation) => {
      it.each([
        ['left_knee', 40, false],
        ['left_knee', 80, true],
        ['left_wrist', 60, false],
        ['left_wrist', 80, true],
      ] as const)('classifies %s displaced %i pixels against a 400 pixel torso (unstable: %s)', (name, displacement, unstable) => {
        // The same physical geometry is normalized into each image shape.
        // Rotating it also checks that the torso reference uses both pixel axes.
        const whole = landmarkPerson().map((landmark) => ({
          ...landmark,
          x: (orientation === 'vertical' ? landmark.x : landmark.y) * 1000 / width,
          y: (orientation === 'vertical' ? landmark.y : landmark.x) * 1000 / height,
        }));
        const refined = whole.map((landmark) => landmark.name !== name ? landmark : {
          ...landmark,
          x: landmark.x + (orientation === 'vertical' ? displacement / width : 0),
          y: landmark.y + (orientation === 'horizontal' ? displacement / height : 0),
        });

        expect(comparePosePasses(whole, refined, width, height).has(name)).toBe(unstable);
      });
    });
  });
});

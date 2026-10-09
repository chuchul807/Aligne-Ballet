import acceptable from './retire-acceptable.json';
import type { Landmark, SupportingSide, ViewType } from '../../src/domain/types';

const source = acceptable as {
  position: 'retire-passe';
  supportingSide: SupportingSide;
  landmarks: readonly Landmark[];
};

export const retireFrontStraightSupport = {
  position: source.position,
  supportingSide: 'left' as const,
  view: 'front' as ViewType,
  expectedPresentRuleIds: ['pelvis-unlevel'] as const,
  expectedAbsentRuleIds: [
    'supporting-knee-bent',
    'supporting-ankle-not-stacked',
    'retire-stack-over-support',
  ] as const,
  landmarks: source.landmarks.map((point) => point.name === 'right_hip'
    ? { ...point, y: 0.66 }
    : point),
};

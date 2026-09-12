import type { Landmark } from '../../src/domain/types';
import { landmarkNames } from '../../src/domain/landmarks';

const points: Partial<Record<Landmark['name'], readonly [number, number]>> = {
  nose: [0.5, 0.1],
  left_shoulder: [0.4, 0.3], right_shoulder: [0.6, 0.3],
  left_elbow: [0.3, 0.38], right_elbow: [0.7, 0.38],
  left_wrist: [0.2, 0.46], right_wrist: [0.8, 0.46],
  left_hip: [0.4, 0.7], right_hip: [0.6, 0.7],
  left_knee: [0.4, 0.85], right_knee: [0.6, 0.85],
  left_ankle: [0.4, 0.95], right_ankle: [0.6, 0.95],
  left_heel: [0.38, 0.96], right_heel: [0.62, 0.96],
  left_foot_index: [0.36, 0.94], right_foot_index: [0.64, 0.94],
  left_ear: [0.46, 0.12], right_ear: [0.54, 0.12],
};

export function landmarkPerson(): readonly Landmark[] {
  return landmarkNames.map((name) => {
    const [x, y] = points[name] ?? [0.5, 0.5];
    return { name, x, y, visibility: 0.9 };
  });
}

export function mirroredPerson(person: readonly Landmark[]): readonly Landmark[] {
  return person.map((point) => ({
    ...point,
    x: 1 - point.x,
    name: point.name.replace(/^left|^right/, (side) => side === 'left' ? 'right' : 'left') as Landmark['name'],
  }));
}

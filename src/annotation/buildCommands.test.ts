import { describe, expect, it } from 'vitest';
import type { Landmark, Observation } from '../domain/types';
import { buildAnnotationCommands } from './buildCommands';

const landmarks: readonly Landmark[] = [
  { name: 'left_hip', x: 0.4, y: 0.3, visibility: 1 },
  { name: 'left_knee', x: 0.4, y: 0.5, visibility: 1 },
  { name: 'left_ankle', x: 0.4, y: 0.8, visibility: 1 },
];

function finding(id: string, annotation: Observation['annotation']): Observation {
  return {
    id,
    ruleId: id,
    dedupeKey: id,
    region: 'supporting-leg',
    priority: 'stability',
    confidence: 'high',
    evidence: ['left_hip', 'left_knee', 'left_ankle'],
    annotation,
    assessability: 'assessable',
    issue: 'The knee is bent.',
    action: 'Straighten the knee.',
    direction: 'upward',
    severity: 1,
  };
}

describe('buildAnnotationCommands', () => {
  it('links a supporting-knee correction to the selected-side hip, knee, and ankle', () => {
    const observation = finding('obs-supporting-knee', [
      { observationId: 'obs-supporting-knee', type: 'joint', joints: ['left_knee'] },
      { observationId: 'obs-supporting-knee', type: 'arrow', joints: ['left_knee'], dx: 0, dy: -0.15 },
    ]);

    const commands = buildAnnotationCommands([observation], landmarks, 'left');

    expect(commands).toEqual(expect.arrayContaining([
      { type: 'skeleton-segment', from: 'left_hip', to: 'left_knee' },
      { type: 'skeleton-segment', from: 'left_knee', to: 'left_ankle' },
      { type: 'highlight-joint', observationId: 'obs-supporting-knee', joint: 'left_knee', label: 1 },
      { type: 'direction-arrow', observationId: 'obs-supporting-knee', anchor: 'left_knee', dx: 0, dy: -0.15, label: 1 },
    ]));
  });

  it('numbers only the first three observations in their written order', () => {
    const observations = [1, 2, 3, 4].map((label) => finding(`obs-${label}`, [
      { observationId: `obs-${label}`, type: 'joint', joints: ['left_knee'] },
    ]));

    const commands = buildAnnotationCommands(observations, landmarks, 'left');

    expect(commands.filter((command) => command.type === 'highlight-joint')).toEqual([
      { type: 'highlight-joint', observationId: 'obs-1', joint: 'left_knee', label: 1 },
      { type: 'highlight-joint', observationId: 'obs-2', joint: 'left_knee', label: 2 },
      { type: 'highlight-joint', observationId: 'obs-3', joint: 'left_knee', label: 3 },
    ]);
  });
});

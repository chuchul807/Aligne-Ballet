import { describe, expect, it } from 'vitest';
import type { Assessability, DrawingCommand, Landmark, LandmarkReliabilityMap, Observation } from '../domain/types';
import type { LandmarkName } from '../domain/landmarks';
import { buildAnnotationCommands } from './buildCommands';
import { landmarkPerson } from '../../tests/builders/landmarks';
import { evaluateLandmarkReliability } from '../reliability/evaluateLandmarkReliability';

const landmarks: readonly Landmark[] = [
  { name: 'left_hip', x: 0.4, y: 0.3, visibility: 1 },
  { name: 'left_knee', x: 0.4, y: 0.5, visibility: 1 },
  { name: 'left_ankle', x: 0.4, y: 0.8, visibility: 1 },
];

const mainStructuralLandmarks: readonly Landmark[] = [
  { name: 'nose', x: 0.5, y: 0.1, visibility: 1 },
  { name: 'left_ear', x: 0.45, y: 0.12, visibility: 1 }, { name: 'right_ear', x: 0.55, y: 0.12, visibility: 1 },
  { name: 'left_shoulder', x: 0.4, y: 0.2, visibility: 1 }, { name: 'right_shoulder', x: 0.6, y: 0.2, visibility: 1 },
  { name: 'left_elbow', x: 0.35, y: 0.3, visibility: 1 }, { name: 'right_elbow', x: 0.65, y: 0.3, visibility: 1 },
  { name: 'left_wrist', x: 0.3, y: 0.4, visibility: 1 }, { name: 'right_wrist', x: 0.7, y: 0.4, visibility: 1 },
  { name: 'left_hip', x: 0.42, y: 0.5, visibility: 1 }, { name: 'right_hip', x: 0.58, y: 0.5, visibility: 1 },
  { name: 'left_knee', x: 0.4, y: 0.65, visibility: 1 }, { name: 'right_knee', x: 0.6, y: 0.65, visibility: 1 },
  { name: 'left_ankle', x: 0.4, y: 0.8, visibility: 1 }, { name: 'right_ankle', x: 0.6, y: 0.8, visibility: 1 },
  { name: 'left_heel', x: 0.38, y: 0.85, visibility: 1 }, { name: 'right_heel', x: 0.62, y: 0.85, visibility: 1 },
  { name: 'left_foot_index', x: 0.36, y: 0.9, visibility: 1 }, { name: 'right_foot_index', x: 0.64, y: 0.9, visibility: 1 },
];

function reliableMap(
  points: readonly Landmark[],
  overrides: Partial<Record<LandmarkName, Assessability>> = {},
): LandmarkReliabilityMap {
  return new Map(points.map((point) => {
    const assessability = overrides[point.name] ?? 'assessable';
    return [point.name, {
      name: point.name,
      assessability,
      confidence: assessability === 'assessable' ? 'high' : 'low',
      reasons: assessability === 'assessable' ? [] : ['implausible-chain'],
    }] as const;
  }));
}

function hasLabel(command: DrawingCommand): command is Extract<DrawingCommand, { label: 1 | 2 | 3 }> {
  return 'label' in command;
}

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
  it('emits neutral dots for every reliable main structural landmark', () => {
    const commands = buildAnnotationCommands([], mainStructuralLandmarks, reliableMap(mainStructuralLandmarks), 'left');

    expect(commands.filter((item) => item.type === 'structural-joint').map((item) => item.joint)).toEqual(expect.arrayContaining([
      'nose', 'left_ear', 'right_ear',
      'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow', 'left_wrist', 'right_wrist',
      'left_hip', 'right_hip', 'left_knee', 'right_knee', 'left_ankle', 'right_ankle',
      'left_heel', 'right_heel', 'left_foot_index', 'right_foot_index',
    ]));
  });

  it('omits an unreliable point and every segment attached to it', () => {
    const unreliable = reliableMap(mainStructuralLandmarks, { left_knee: 'unassessable' });
    const correction = finding('unreliable-knee', [{ observationId: 'unreliable-knee', type: 'joint', joints: ['left_knee'] }]);
    const commands = buildAnnotationCommands([correction], mainStructuralLandmarks, unreliable, 'left');

    expect(commands).not.toContainEqual(expect.objectContaining({ type: 'structural-joint', joint: 'left_knee' }));
    expect(commands.some((item) => item.type === 'skeleton-segment' && (item.from === 'left_knee' || item.to === 'left_knee'))).toBe(false);
    expect(commands).not.toContainEqual(expect.objectContaining({ observationId: 'unreliable-knee' }));
  });

  it('omits a cross-pass-disagreed point and every segment attached to it', () => {
    const points = landmarkPerson();
    const commands = buildAnnotationCommands(
      [],
      points,
      evaluateLandmarkReliability(points, 'front', new Set(['left_knee'])),
      'left',
    );

    expect(commands).not.toContainEqual(expect.objectContaining({ type: 'structural-joint', joint: 'left_knee' }));
    expect(commands.some((item) => item.type === 'skeleton-segment'
      && (item.from === 'left_knee' || item.to === 'left_knee'))).toBe(false);
  });

  it('numbers only observations selected for written feedback', () => {
    const selectedTopTwo = [
      finding('one', [{ observationId: 'one', type: 'region', joints: ['left_knee'] }]),
      finding('two', [{ observationId: 'two', type: 'region', joints: ['left_hip'] }]),
    ] as const;
    const commands = buildAnnotationCommands(selectedTopTwo, landmarks, reliableMap(landmarks), 'left');

    expect(commands.filter(hasLabel).map((item) => item.label)).toEqual(expect.arrayContaining([1, 2]));
    expect(commands.some((item) => hasLabel(item) && item.label === 3)).toBe(false);
  });

  it('links a supporting-knee correction to the selected-side hip, knee, and ankle', () => {
    const observation = finding('obs-supporting-knee', [
      { observationId: 'obs-supporting-knee', type: 'joint', joints: ['left_knee'] },
      { observationId: 'obs-supporting-knee', type: 'arrow', joints: ['left_knee'], dx: 0, dy: -0.15 },
    ]);

    const commands = buildAnnotationCommands([observation], landmarks, reliableMap(landmarks), 'left');

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

    const commands = buildAnnotationCommands(observations, landmarks, reliableMap(landmarks), 'left');

    expect(commands.filter((command) => command.type === 'highlight-joint')).toEqual([
      { type: 'highlight-joint', observationId: 'obs-1', joint: 'left_knee', label: 1 },
      { type: 'highlight-joint', observationId: 'obs-2', joint: 'left_knee', label: 2 },
      { type: 'highlight-joint', observationId: 'obs-3', joint: 'left_knee', label: 3 },
    ]);
  });
});

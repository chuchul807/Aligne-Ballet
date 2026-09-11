import type { LandmarkName } from '../domain/landmarks';
import type { DrawingCommand, Landmark, LandmarkReliabilityMap, Observation, SupportingSide } from '../domain/types';

export const MAIN_STRUCTURAL_LANDMARKS = [
  'nose', 'left_ear', 'right_ear',
  'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow', 'left_wrist', 'right_wrist',
  'left_hip', 'right_hip', 'left_knee', 'right_knee', 'left_ankle', 'right_ankle',
  'left_heel', 'right_heel', 'left_foot_index', 'right_foot_index',
] as const satisfies readonly LandmarkName[];

const STRUCTURAL_SEGMENTS: readonly (readonly [LandmarkName, LandmarkName])[] = [
  ['left_shoulder', 'right_shoulder'],
  ['left_shoulder', 'left_elbow'], ['left_elbow', 'left_wrist'],
  ['right_shoulder', 'right_elbow'], ['right_elbow', 'right_wrist'],
  ['left_shoulder', 'left_hip'], ['right_shoulder', 'right_hip'], ['left_hip', 'right_hip'],
  ['left_hip', 'left_knee'], ['left_knee', 'left_ankle'],
  ['right_hip', 'right_knee'], ['right_knee', 'right_ankle'],
  ['left_ankle', 'left_heel'], ['left_heel', 'left_foot_index'], ['left_ankle', 'left_foot_index'],
  ['right_ankle', 'right_heel'], ['right_heel', 'right_foot_index'], ['right_ankle', 'right_foot_index'],
];

function isReliable(landmarks: ReadonlySet<LandmarkName>, reliability: LandmarkReliabilityMap, joints: readonly LandmarkName[]): boolean {
  return joints.every((joint) => landmarks.has(joint) && reliability.get(joint)?.assessability === 'assessable');
}

function fallbackInstructions(observation: Observation, supportingSide: SupportingSide): Observation['annotation'] {
  if (observation.ruleId === 'supporting-knee-bent') {
    const knee = `${supportingSide}_knee` as LandmarkName;
    return [
      { observationId: observation.id, type: 'joint', joints: [knee] },
      { observationId: observation.id, type: 'arrow', joints: [knee], dx: 0, dy: -0.12 },
    ];
  }
  return observation.evidence.length === 1
    ? [{ observationId: observation.id, type: 'joint', joints: observation.evidence as readonly LandmarkName[] }]
    : [{ observationId: observation.id, type: 'region', joints: observation.evidence as readonly LandmarkName[] }];
}

export function buildAnnotationCommands(
  observations: readonly Observation[],
  landmarks: readonly Landmark[],
  reliability: LandmarkReliabilityMap,
  supportingSide: SupportingSide,
): readonly DrawingCommand[] {
  const availableLandmarks = new Set(landmarks.map((landmark) => landmark.name));
  const commands: DrawingCommand[] = MAIN_STRUCTURAL_LANDMARKS
    .filter((joint) => isReliable(availableLandmarks, reliability, [joint]))
    .map((joint) => ({ type: 'structural-joint', joint }));

  commands.push(...STRUCTURAL_SEGMENTS
    .filter(([from, to]) => isReliable(availableLandmarks, reliability, [from, to]))
    .map(([from, to]) => ({ type: 'skeleton-segment' as const, from, to })));

  observations.slice(0, 3).forEach((observation, index) => {
    const label = (index + 1) as 1 | 2 | 3;
    const instructions = observation.annotation.length > 0 ? observation.annotation : fallbackInstructions(observation, supportingSide);
    for (const instruction of instructions) {
      if (!isReliable(availableLandmarks, reliability, instruction.joints)) continue;
      if (instruction.type === 'joint') {
        for (const joint of instruction.joints) commands.push({ type: 'highlight-joint', observationId: observation.id, joint, label });
      } else if (instruction.type === 'region') {
        commands.push({ type: 'highlight-region', observationId: observation.id, joints: instruction.joints, label });
      } else {
        const anchor = instruction.joints[0];
        if (anchor !== undefined) commands.push({ type: 'direction-arrow', observationId: observation.id, anchor, dx: instruction.dx ?? 0, dy: instruction.dy ?? -0.12, label });
      }
    }
  });

  return commands;
}

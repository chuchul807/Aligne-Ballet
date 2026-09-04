import type { LandmarkName } from '../domain/landmarks';
import type { DrawingCommand, Landmark, Observation, SupportingSide } from '../domain/types';

const SKELETON_SEGMENTS: readonly (readonly [LandmarkName, LandmarkName])[] = [
  ['left_shoulder', 'right_shoulder'],
  ['left_shoulder', 'left_elbow'], ['left_elbow', 'left_wrist'],
  ['right_shoulder', 'right_elbow'], ['right_elbow', 'right_wrist'],
  ['left_shoulder', 'left_hip'], ['right_shoulder', 'right_hip'], ['left_hip', 'right_hip'],
  ['left_hip', 'left_knee'], ['left_knee', 'left_ankle'], ['left_ankle', 'left_foot_index'],
  ['right_hip', 'right_knee'], ['right_knee', 'right_ankle'], ['right_ankle', 'right_foot_index'],
];

function isVisible(landmarks: ReadonlySet<LandmarkName>, joints: readonly LandmarkName[]): boolean {
  return joints.every((joint) => landmarks.has(joint));
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
  supportingSide: SupportingSide,
): readonly DrawingCommand[] {
  const visibleLandmarks = new Set(landmarks.filter((landmark) => landmark.visibility > 0).map((landmark) => landmark.name));
  const commands: DrawingCommand[] = SKELETON_SEGMENTS
    .filter(([from, to]) => isVisible(visibleLandmarks, [from, to]))
    .map(([from, to]) => ({ type: 'skeleton-segment', from, to }));

  observations.slice(0, 3).forEach((observation, index) => {
    const label = (index + 1) as 1 | 2 | 3;
    const instructions = observation.annotation.length > 0 ? observation.annotation : fallbackInstructions(observation, supportingSide);
    for (const instruction of instructions) {
      if (!isVisible(visibleLandmarks, instruction.joints)) continue;
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

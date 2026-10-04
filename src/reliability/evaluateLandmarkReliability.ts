import { landmarkNames, type LandmarkName } from '../domain/landmarks';
import type {
  Landmark,
  LandmarkReliability,
  LandmarkReliabilityMap,
  ReliabilityReason,
  ViewType,
} from '../domain/types';

const MIN_VISIBILITY = 0.60;
const HIGH_VISIBILITY = 0.80;
const FRAME_MARGIN = 0.02;
const MIN_ADJACENT_SEGMENT_RATIO = 0.35;
const MAX_ADJACENT_SEGMENT_RATIO = 2.85;
const MAX_CONNECTED_SEGMENT_IN_TORSOS = 1.25;
const OCCLUSION_DISTANCE_IN_TORSOS = 0.08;

const geometryChains = [
  ['left_shoulder', 'left_elbow', 'left_wrist'],
  ['right_shoulder', 'right_elbow', 'right_wrist'],
  ['left_hip', 'left_knee', 'left_ankle'],
  ['right_hip', 'right_knee', 'right_ankle'],
  ['left_ankle', 'left_heel', 'left_foot_index'],
  ['right_ankle', 'right_heel', 'right_foot_index'],
] as const satisfies readonly (readonly [LandmarkName, LandmarkName, LandmarkName])[];

const occlusionPairs = [
  ['left_elbow', 'right_elbow'],
  ['left_wrist', 'right_wrist'],
  ['left_knee', 'right_knee'],
  ['left_ankle', 'right_ankle'],
  ['left_heel', 'right_heel'],
  ['left_foot_index', 'right_foot_index'],
] as const satisfies readonly (readonly [LandmarkName, LandmarkName])[];

function isFiniteLandmark(point: Landmark): boolean {
  return Number.isFinite(point.x)
    && Number.isFinite(point.y)
    && Number.isFinite(point.visibility)
    && (point.z === undefined || Number.isFinite(point.z));
}

function isInsideFrame(point: Landmark): boolean {
  return point.x >= FRAME_MARGIN
    && point.x <= 1 - FRAME_MARGIN
    && point.y >= FRAME_MARGIN
    && point.y <= 1 - FRAME_MARGIN;
}

function distance(first: Landmark, second: Landmark): number {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function torsoLength(points: ReadonlyMap<LandmarkName, Landmark>): number | null {
  const leftShoulder = points.get('left_shoulder');
  const rightShoulder = points.get('right_shoulder');
  const leftHip = points.get('left_hip');
  const rightHip = points.get('right_hip');

  if (
    !leftShoulder || !rightShoulder || !leftHip || !rightHip
    || !isFiniteLandmark(leftShoulder) || !isFiniteLandmark(rightShoulder)
    || !isFiniteLandmark(leftHip) || !isFiniteLandmark(rightHip)
  ) {
    return null;
  }

  return Math.hypot(
    ((leftShoulder.x + rightShoulder.x) - (leftHip.x + rightHip.x)) / 2,
    ((leftShoulder.y + rightShoulder.y) - (leftHip.y + rightHip.y)) / 2,
  );
}

function addReason(
  reasons: Map<LandmarkName, ReliabilityReason[]>,
  name: LandmarkName,
  reason: ReliabilityReason,
): void {
  const entry = reasons.get(name)!;
  if (!entry.includes(reason)) entry.push(reason);
}

export function evaluateLandmarkReliability(
  landmarks: readonly Landmark[],
  view: ViewType,
  disagreements: ReadonlySet<LandmarkName> = new Set(),
): LandmarkReliabilityMap {
  void view;

  const points = new Map<LandmarkName, Landmark>();
  for (const point of landmarks) points.set(point.name, point);

  const reasons = new Map<LandmarkName, ReliabilityReason[]>(
    landmarkNames.map((name) => [name, []]),
  );

  for (const name of landmarkNames) {
    const point = points.get(name);
    if (!point) {
      addReason(reasons, name, 'missing');
      continue;
    }
    if (!isFiniteLandmark(point)) addReason(reasons, name, 'non-finite');
    if (!Number.isFinite(point.visibility) || point.visibility < MIN_VISIBILITY) {
      addReason(reasons, name, 'low-visibility');
    }
    if (point.presence !== undefined && (!Number.isFinite(point.presence) || point.presence < MIN_VISIBILITY)) {
      addReason(reasons, name, 'low-presence');
    }
    if (disagreements.has(name)) addReason(reasons, name, 'cross-pass-disagreement');
    if (Number.isFinite(point.x) && Number.isFinite(point.y) && !isInsideFrame(point)) {
      addReason(reasons, name, 'outside-frame');
    }
  }

  const torso = torsoLength(points);
  for (const [firstName, middleName, lastName] of geometryChains) {
    const first = points.get(firstName);
    const middle = points.get(middleName);
    const last = points.get(lastName);
    if (!first || !middle || !last || ![first, middle, last].every(isFiniteLandmark)) continue;

    const firstSegment = distance(first, middle);
    const secondSegment = distance(middle, last);
    const ratio = firstSegment / secondSegment;
    if (!(ratio >= MIN_ADJACENT_SEGMENT_RATIO && ratio <= MAX_ADJACENT_SEGMENT_RATIO)) {
      addReason(reasons, middleName, 'implausible-chain');
      // Attribute ratio-only ambiguity to the far end of the disproportionately
      // long segment. Keeping the other endpoint usable avoids discarding a
      // stable hip/shoulder solely because a bent limb is foreshortened.
      if (ratio < MIN_ADJACENT_SEGMENT_RATIO) addReason(reasons, lastName, 'implausible-chain');
      if (ratio > MAX_ADJACENT_SEGMENT_RATIO) addReason(reasons, firstName, 'implausible-chain');
    }
    if (torso !== null && torso > 0 && firstSegment > MAX_CONNECTED_SEGMENT_IN_TORSOS * torso) {
      addReason(reasons, firstName, 'implausible-chain');
      addReason(reasons, middleName, 'implausible-chain');
    }
    if (torso !== null && torso > 0 && secondSegment > MAX_CONNECTED_SEGMENT_IN_TORSOS * torso) {
      addReason(reasons, middleName, 'implausible-chain');
      addReason(reasons, lastName, 'implausible-chain');
    }
  }

  if (torso !== null && torso > 0) {
    for (const [leftName, rightName] of occlusionPairs) {
      const left = points.get(leftName);
      const right = points.get(rightName);
      if (!left || !right || !isFiniteLandmark(left) || !isFiniteLandmark(right)) continue;
      if (distance(left, right) <= OCCLUSION_DISTANCE_IN_TORSOS * torso) {
        addReason(reasons, leftName, 'possible-occlusion');
        addReason(reasons, rightName, 'possible-occlusion');
      }
    }
  }

  return new Map(landmarkNames.map((name): [LandmarkName, LandmarkReliability] => {
    const point = points.get(name);
    const pointReasons = reasons.get(name)!;
    const assessability = pointReasons.length === 0 ? 'assessable' : 'unassessable';
    const confidence = assessability === 'unassessable'
      ? 'low'
      : point!.visibility >= HIGH_VISIBILITY ? 'high' : 'medium';

    return [name, { name, confidence, assessability, reasons: pointReasons }];
  }));
}

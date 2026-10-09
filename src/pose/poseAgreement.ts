import { landmarkNames, type LandmarkName } from '../domain/landmarks';
import type { Landmark } from '../domain/types';

export const MAJOR_JOINT_AGREEMENT = 0.12;
export const FLEXIBLE_JOINT_AGREEMENT = 0.18;

const MIN_EVIDENCE = 0.60;
const KNEE_FORWARD_DEPTH_THRESHOLD = 0.03;
const MAJOR_JOINTS = new Set(['shoulder', 'elbow', 'hip', 'knee', 'ankle']);
const FOOT_DEPTH_PAIRS = [
  ['left_heel', 'left_foot_index'],
  ['right_heel', 'right_foot_index'],
] as const satisfies readonly (readonly [LandmarkName, LandmarkName])[];
const KNEE_DEPTH_CHAINS = [
  ['left_hip', 'left_knee', 'left_ankle'],
  ['right_hip', 'right_knee', 'right_ankle'],
] as const satisfies readonly (readonly [LandmarkName, LandmarkName, LandmarkName])[];

function valid(point: Landmark | undefined): point is Landmark {
  return point !== undefined
    && Number.isFinite(point.x)
    && Number.isFinite(point.y)
    && point.x >= 0 && point.x <= 1
    && point.y >= 0 && point.y <= 1
    && (point.z === undefined || Number.isFinite(point.z))
    && Number.isFinite(point.visibility)
    && point.visibility >= MIN_EVIDENCE
    && (point.presence === undefined
      || (Number.isFinite(point.presence) && point.presence >= MIN_EVIDENCE));
}

function byName(landmarks: readonly Landmark[]): ReadonlyMap<LandmarkName, Landmark> {
  return new Map(landmarks.map((landmark) => [landmark.name, landmark]));
}

function torsoLength(points: ReadonlyMap<LandmarkName, Landmark>, sourceWidth: number, sourceHeight: number): number | null {
  const leftShoulder = points.get('left_shoulder');
  const rightShoulder = points.get('right_shoulder');
  const leftHip = points.get('left_hip');
  const rightHip = points.get('right_hip');
  if (!valid(leftShoulder) || !valid(rightShoulder) || !valid(leftHip) || !valid(rightHip)) return null;
  const shoulderX = (leftShoulder.x + rightShoulder.x) / 2;
  const shoulderY = (leftShoulder.y + rightShoulder.y) / 2;
  const hipX = (leftHip.x + rightHip.x) / 2;
  const hipY = (leftHip.y + rightHip.y) / 2;
  const length = Math.hypot((shoulderX - hipX) * sourceWidth, (shoulderY - hipY) * sourceHeight);
  return Number.isFinite(length) && length > 0 ? length : null;
}

function frontalBodyWidth(points: ReadonlyMap<LandmarkName, Landmark>): number | null {
  const leftShoulder = points.get('left_shoulder');
  const rightShoulder = points.get('right_shoulder');
  const leftHip = points.get('left_hip');
  const rightHip = points.get('right_hip');
  if (!valid(leftShoulder) || !valid(rightShoulder) || !valid(leftHip) || !valid(rightHip)) return null;
  const width = (Math.abs(leftShoulder.x - rightShoulder.x) + Math.abs(leftHip.x - rightHip.x)) / 2;
  return Number.isFinite(width) && width > 0 ? width : null;
}

function isMajor(name: LandmarkName): boolean {
  const joint = name.replace(/^left_|^right_/, '');
  return MAJOR_JOINTS.has(joint);
}

function footDepthCue(
  points: ReadonlyMap<LandmarkName, Landmark>,
  heelName: LandmarkName,
  toeName: LandmarkName,
): number | null {
  const heel = points.get(heelName)?.z;
  const toe = points.get(toeName)?.z;
  return heel !== undefined && toe !== undefined && Number.isFinite(heel) && Number.isFinite(toe)
    ? toe - heel
    : null;
}

function kneeDepthCue(
  points: ReadonlyMap<LandmarkName, Landmark>,
  hipName: LandmarkName,
  kneeName: LandmarkName,
  ankleName: LandmarkName,
  sourceWidth: number,
  sourceHeight: number,
): number | null {
  const hip = points.get(hipName);
  const knee = points.get(kneeName);
  const ankle = points.get(ankleName);
  if (!hip || !knee || !ankle || !valid(hip) || !valid(knee) || !valid(ankle)) return null;
  if (hip.z === undefined || knee.z === undefined || ankle.z === undefined) return null;
  const legX = (ankle.x - hip.x) * sourceWidth;
  const legY = (ankle.y - hip.y) * sourceHeight;
  const squaredLegLength = legX * legX + legY * legY;
  if (squaredLegLength === 0) return null;
  const kneeProgress = Math.max(0, Math.min(1, (
    (knee.x - hip.x) * sourceWidth * legX
      + (knee.y - hip.y) * sourceHeight * legY
  ) / squaredLegLength));
  const straightLegDepth = hip.z + (ankle.z - hip.z) * kneeProgress;
  const bodyWidth = frontalBodyWidth(points);
  return bodyWidth === null ? null : (straightLegDepth - knee.z) / bodyWidth;
}

export function comparePosePasses(
  whole: readonly Landmark[],
  refined: readonly Landmark[],
  sourceWidth: number,
  sourceHeight: number,
): ReadonlySet<LandmarkName> {
  const wholePoints = byName(whole);
  const refinedPoints = byName(refined);
  const unstable = new Set<LandmarkName>();
  const refinedTorso = torsoLength(refinedPoints, sourceWidth, sourceHeight);
  if (refinedTorso === null) return new Set(landmarkNames);

  for (const name of landmarkNames) {
    const wholePoint = wholePoints.get(name);
    const refinedPoint = refinedPoints.get(name);
    if (!valid(wholePoint) || !valid(refinedPoint)) {
      unstable.add(name);
      continue;
    }
    const distance = Math.hypot(
      (wholePoint.x - refinedPoint.x) * sourceWidth,
      (wholePoint.y - refinedPoint.y) * sourceHeight,
    );
    const threshold = (isMajor(name) ? MAJOR_JOINT_AGREEMENT : FLEXIBLE_JOINT_AGREEMENT) * refinedTorso;
    if (!Number.isFinite(distance) || distance > threshold) unstable.add(name);
  }
  for (const [heelName, toeName] of FOOT_DEPTH_PAIRS) {
    const wholeCue = footDepthCue(wholePoints, heelName, toeName);
    const refinedCue = footDepthCue(refinedPoints, heelName, toeName);
    const onePassMissingDepth = (wholeCue === null) !== (refinedCue === null);
    const depthOrderChanged = wholeCue !== null && refinedCue !== null
      && Math.sign(wholeCue) !== Math.sign(refinedCue);
    if (onePassMissingDepth || depthOrderChanged) {
      unstable.add(heelName);
      unstable.add(toeName);
    }
  }
  for (const [hipName, kneeName, ankleName] of KNEE_DEPTH_CHAINS) {
    const wholeCue = kneeDepthCue(wholePoints, hipName, kneeName, ankleName, sourceWidth, sourceHeight);
    const refinedCue = kneeDepthCue(refinedPoints, hipName, kneeName, ankleName, sourceWidth, sourceHeight);
    const onePassMissingDepth = (wholeCue === null) !== (refinedCue === null);
    const depthDirectionChanged = wholeCue !== null && refinedCue !== null && (
      (wholeCue > KNEE_FORWARD_DEPTH_THRESHOLD && refinedCue <= 0)
      || (refinedCue > KNEE_FORWARD_DEPTH_THRESHOLD && wholeCue <= 0)
    );
    if (onePassMissingDepth || depthDirectionChanged) unstable.add(kneeName);
  }
  return unstable;
}

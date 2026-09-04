import { oppositeSide, sideLandmark } from '../domain/landmarks';
import type { Landmark, SupportingSide } from '../domain/types';
import { angleDeg, distance, midpoint, normalisedDistance, slopeDeg, type Point } from './geometry';

export interface MeasurementSet {
  torsoLength: number;
  supportingKneeAngle: number | null;
  workingKneeAngle: number | null;
  pelvisSlope: number | null;
  shoulderSlope: number | null;
  torsoLateralOffset: number | null;
  workingAnkleToSupportingKnee: number | null;
  workingKneeLateralOffset: number | null;
  workingKneeHeightFromHip: number | null;
  workingAnkleHeightFromHip: number | null;
  supportingAnkleUnderHipOffset: number | null;
  leftElbowAngle: number | null;
  rightElbowAngle: number | null;
  headTiltFromTorso: number | null;
}

function indexed(landmarks: readonly Landmark[]): Map<Landmark['name'], Landmark> {
  return new Map(landmarks.map((landmark) => [landmark.name, landmark]));
}

function point(points: Map<Landmark['name'], Landmark>, name: Landmark['name']): Point | null {
  const landmark = points.get(name);
  return landmark && Number.isFinite(landmark.x) && Number.isFinite(landmark.y) ? { x: landmark.x, y: landmark.y } : null;
}

function threePointAngle(points: Map<Landmark['name'], Landmark>, first: Landmark['name'], vertex: Landmark['name'], last: Landmark['name']): number | null {
  const a = point(points, first);
  const b = point(points, vertex);
  const c = point(points, last);
  return a && b && c ? angleDeg(a, b, c) : null;
}

function normalisedHorizontalOffset(a: Point | null, b: Point | null, torsoLength: number): number | null {
  return a && b && Number.isFinite(torsoLength) && torsoLength > 0 ? Math.abs(a.x - b.x) / torsoLength : null;
}

function normalisedHeight(from: Point | null, to: Point | null, torsoLength: number): number | null {
  return from && to && Number.isFinite(torsoLength) && torsoLength > 0 ? (from.y - to.y) / torsoLength : null;
}

function axisDifference(first: number | null, second: number | null): number | null {
  if (first === null || second === null || !Number.isFinite(first) || !Number.isFinite(second)) return null;
  const raw = Math.abs(first - second) % 180;
  return raw > 90 ? 180 - raw : raw;
}

export function measurePose(landmarks: readonly Landmark[], supportingSide: SupportingSide): MeasurementSet {
  const points = indexed(landmarks);
  const workingSide = oppositeSide(supportingSide);
  const leftShoulder = point(points, 'left_shoulder');
  const rightShoulder = point(points, 'right_shoulder');
  const leftHip = point(points, 'left_hip');
  const rightHip = point(points, 'right_hip');
  const shoulderMidpoint = leftShoulder && rightShoulder ? midpoint(leftShoulder, rightShoulder) : null;
  const hipMidpoint = leftHip && rightHip ? midpoint(leftHip, rightHip) : null;
  const torsoLength = shoulderMidpoint && hipMidpoint ? distance(shoulderMidpoint, hipMidpoint) ?? 0 : 0;
  const supportHip = point(points, sideLandmark(supportingSide, 'hip'));
  const supportKnee = point(points, sideLandmark(supportingSide, 'knee'));
  const supportAnkle = point(points, sideLandmark(supportingSide, 'ankle'));
  const workingKnee = point(points, sideLandmark(workingSide, 'knee'));
  const workingAnkle = point(points, sideLandmark(workingSide, 'ankle'));
  const nose = point(points, 'nose');

  return {
    torsoLength,
    supportingKneeAngle: threePointAngle(points, sideLandmark(supportingSide, 'hip'), sideLandmark(supportingSide, 'knee'), sideLandmark(supportingSide, 'ankle')),
    workingKneeAngle: threePointAngle(points, sideLandmark(workingSide, 'hip'), sideLandmark(workingSide, 'knee'), sideLandmark(workingSide, 'ankle')),
    pelvisSlope: leftHip && rightHip ? slopeDeg(leftHip, rightHip) : null,
    shoulderSlope: leftShoulder && rightShoulder ? slopeDeg(leftShoulder, rightShoulder) : null,
    torsoLateralOffset: shoulderMidpoint && supportHip && torsoLength > 0
      ? ((shoulderMidpoint.x - supportHip.x) * (supportingSide === 'left' ? 1 : -1)) / torsoLength
      : null,
    workingAnkleToSupportingKnee: workingAnkle && supportKnee ? normalisedDistance(workingAnkle, supportKnee, torsoLength) : null,
    workingKneeLateralOffset: normalisedHorizontalOffset(workingKnee, supportHip, torsoLength),
    workingKneeHeightFromHip: normalisedHeight(supportHip, workingKnee, torsoLength),
    workingAnkleHeightFromHip: normalisedHeight(supportHip, workingAnkle, torsoLength),
    supportingAnkleUnderHipOffset: normalisedHorizontalOffset(supportHip, supportAnkle, torsoLength),
    leftElbowAngle: threePointAngle(points, 'left_shoulder', 'left_elbow', 'left_wrist'),
    rightElbowAngle: threePointAngle(points, 'right_shoulder', 'right_elbow', 'right_wrist'),
    headTiltFromTorso: axisDifference(nose && shoulderMidpoint ? slopeDeg(nose, shoulderMidpoint) : null, shoulderMidpoint && hipMidpoint ? slopeDeg(shoulderMidpoint, hipMidpoint) : null),
  };
}

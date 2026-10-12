import { oppositeSide, sideLandmark } from '../domain/landmarks';
import type { LandmarkName } from '../domain/landmarks';
import type {
  Confidence,
  Landmark,
  LandmarkReliabilityMap,
  MeasurementSet,
  PoseMeasurement,
  SupportingSide,
  ViewType,
} from '../domain/types';
import { angleDeg, distance, midpoint, normalisedDistance, slopeDeg, type Point } from './geometry';

export type { MeasurementSet } from '../domain/types';

const confidenceRank: Record<Confidence, number> = { low: 0, medium: 1, high: 2 };

function lowestConfidence(
  evidence: readonly LandmarkName[],
  reliability: LandmarkReliabilityMap,
): Confidence {
  return evidence.reduce<Confidence>((lowest, name) => {
    const confidence = reliability.get(name)?.confidence ?? 'low';
    return confidenceRank[confidence] < confidenceRank[lowest] ? confidence : lowest;
  }, 'high');
}

function uniqueEvidence(...groups: readonly (readonly LandmarkName[])[]): readonly LandmarkName[] {
  return [...new Set(groups.flat())];
}

function measurement(
  evidence: readonly LandmarkName[],
  reliability: LandmarkReliabilityMap,
  calculate: () => number | null,
): PoseMeasurement {
  const confidence = lowestConfidence(evidence, reliability);
  for (const name of evidence) {
    const entry = reliability.get(name);
    if (!entry || entry.assessability === 'unassessable') {
      return {
        value: null,
        confidence,
        assessability: 'unassessable',
        evidence,
        reason: entry?.reasons[0] ?? 'missing',
      };
    }
  }

  const value = calculate();
  if (value === null || !Number.isFinite(value)) {
    return { value: null, confidence, assessability: 'unassessable', evidence, reason: 'missing-geometry' };
  }
  return { value, confidence, assessability: 'assessable', evidence };
}

function normalisedMeasurement(
  evidence: readonly LandmarkName[],
  torso: PoseMeasurement,
  reliability: LandmarkReliabilityMap,
  calculate: (torsoLength: number) => number | null,
): PoseMeasurement {
  const combinedEvidence = uniqueEvidence(evidence, torso.evidence);
  const confidence = lowestConfidence(combinedEvidence, reliability);
  if (torso.assessability !== 'assessable' || torso.value === null || torso.value <= 0) {
    return {
      value: null,
      confidence,
      assessability: 'unassessable',
      evidence: combinedEvidence,
      reason: 'missing-geometry',
    };
  }
  return measurement(combinedEvidence, reliability, () => calculate(torso.value!));
}

function unsupportedViewMeasurement(
  evidence: readonly LandmarkName[],
  reliability: LandmarkReliabilityMap,
): PoseMeasurement {
  return {
    value: null,
    confidence: lowestConfidence(evidence, reliability),
    assessability: 'unassessable',
    evidence,
    reason: 'unsupported-view',
  };
}

function indexed(landmarks: readonly Landmark[]): Map<Landmark['name'], Landmark> {
  return new Map(landmarks.map((landmark) => [landmark.name, landmark]));
}

function point(points: Map<Landmark['name'], Landmark>, name: Landmark['name']): Point | null {
  const landmark = points.get(name);
  return landmark && Number.isFinite(landmark.x) && Number.isFinite(landmark.y) ? { x: landmark.x, y: landmark.y } : null;
}

function depth(points: Map<Landmark['name'], Landmark>, name: Landmark['name']): number | null {
  const value = points.get(name)?.z;
  return value !== undefined && Number.isFinite(value) ? value : null;
}

function threePointAngle(points: Map<Landmark['name'], Landmark>, first: Landmark['name'], vertex: Landmark['name'], last: Landmark['name']): number | null {
  const a = point(points, first);
  const b = point(points, vertex);
  const c = point(points, last);
  return a && b && c ? angleDeg(a, b, c) : null;
}

function kneeForwardDepthOffset(
  points: Map<Landmark['name'], Landmark>,
  hipName: LandmarkName,
  kneeName: LandmarkName,
  ankleName: LandmarkName,
  sourceWidth: number,
  sourceHeight: number,
): number | null {
  const hip = point(points, hipName);
  const knee = point(points, kneeName);
  const ankle = point(points, ankleName);
  const hipDepth = depth(points, hipName);
  const kneeDepth = depth(points, kneeName);
  const ankleDepth = depth(points, ankleName);
  if (!hip || !knee || !ankle || hipDepth === null || kneeDepth === null || ankleDepth === null) return null;

  const legX = (ankle.x - hip.x) * sourceWidth;
  const legY = (ankle.y - hip.y) * sourceHeight;
  const squaredLegLength = legX * legX + legY * legY;
  if (squaredLegLength === 0) return null;
  const kneeProgress = Math.max(0, Math.min(1, (
    (knee.x - hip.x) * sourceWidth * legX
      + (knee.y - hip.y) * sourceHeight * legY
  ) / squaredLegLength));
  const straightLegDepth = hipDepth + (ankleDepth - hipDepth) * kneeProgress;
  return straightLegDepth - kneeDepth;
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

export function measurePose(
  landmarks: readonly Landmark[],
  supportingSide: SupportingSide,
  reliability: LandmarkReliabilityMap,
  view: ViewType,
  sourceWidth: number,
  sourceHeight: number,
): MeasurementSet {
  const points = indexed(landmarks);
  const workingSide = oppositeSide(supportingSide);
  const leftShoulder = point(points, 'left_shoulder');
  const rightShoulder = point(points, 'right_shoulder');
  const leftHip = point(points, 'left_hip');
  const rightHip = point(points, 'right_hip');
  const shoulderMidpoint = leftShoulder && rightShoulder ? midpoint(leftShoulder, rightShoulder) : null;
  const hipMidpoint = leftHip && rightHip ? midpoint(leftHip, rightHip) : null;
  const torsoEvidence = ['left_shoulder', 'right_shoulder', 'left_hip', 'right_hip'] as const;
  const torsoLength = measurement(torsoEvidence, reliability, () => (
    shoulderMidpoint && hipMidpoint ? distance(shoulderMidpoint, hipMidpoint) : null
  ));
  const frontalBodyWidth = measurement(torsoEvidence, reliability, () => (
    leftShoulder && rightShoulder && leftHip && rightHip
      ? (Math.abs(leftShoulder.x - rightShoulder.x) + Math.abs(leftHip.x - rightHip.x)) / 2
      : null
  ));
  const supportHip = point(points, sideLandmark(supportingSide, 'hip'));
  const supportKnee = point(points, sideLandmark(supportingSide, 'knee'));
  const supportAnkle = point(points, sideLandmark(supportingSide, 'ankle'));
  const workingKnee = point(points, sideLandmark(workingSide, 'knee'));
  const workingHip = point(points, sideLandmark(workingSide, 'hip'));
  const workingAnkle = point(points, sideLandmark(workingSide, 'ankle'));
  const supportingFootIndex = point(points, sideLandmark(supportingSide, 'foot_index'));
  const workingFootIndex = point(points, sideLandmark(workingSide, 'foot_index'));
  const workingHeel = point(points, sideLandmark(workingSide, 'heel'));
  const nose = point(points, 'nose');

  return {
    torsoLength,
    supportingKneeAngle: measurement([
      sideLandmark(supportingSide, 'hip'),
      sideLandmark(supportingSide, 'knee'),
      sideLandmark(supportingSide, 'ankle'),
    ], reliability, () => threePointAngle(points, sideLandmark(supportingSide, 'hip'), sideLandmark(supportingSide, 'knee'), sideLandmark(supportingSide, 'ankle'))),
    supportingKneeForwardDepthCue: normalisedMeasurement([
      sideLandmark(supportingSide, 'hip'),
      sideLandmark(supportingSide, 'knee'),
      sideLandmark(supportingSide, 'ankle'),
    ], frontalBodyWidth, reliability, (bodyWidth) => {
      const offset = kneeForwardDepthOffset(
        points,
        sideLandmark(supportingSide, 'hip'),
        sideLandmark(supportingSide, 'knee'),
        sideLandmark(supportingSide, 'ankle'),
        sourceWidth,
        sourceHeight,
      );
      return offset === null ? null : offset / bodyWidth;
    }),
    workingKneeAngle: measurement([
      sideLandmark(workingSide, 'hip'),
      sideLandmark(workingSide, 'knee'),
      sideLandmark(workingSide, 'ankle'),
    ], reliability, () => threePointAngle(points, sideLandmark(workingSide, 'hip'), sideLandmark(workingSide, 'knee'), sideLandmark(workingSide, 'ankle'))),
    workingKneeForwardDepthCue: normalisedMeasurement([
      sideLandmark(workingSide, 'hip'),
      sideLandmark(workingSide, 'knee'),
      sideLandmark(workingSide, 'ankle'),
    ], frontalBodyWidth, reliability, (bodyWidth) => {
      const offset = kneeForwardDepthOffset(
        points,
        sideLandmark(workingSide, 'hip'),
        sideLandmark(workingSide, 'knee'),
        sideLandmark(workingSide, 'ankle'),
        sourceWidth,
        sourceHeight,
      );
      return offset === null ? null : offset / bodyWidth;
    }),
    pelvisSlope: measurement(['left_hip', 'right_hip'], reliability, () => (
      leftHip && rightHip ? slopeDeg(leftHip, rightHip) : null
    )),
    shoulderSlope: measurement(['left_shoulder', 'right_shoulder'], reliability, () => (
      leftShoulder && rightShoulder ? slopeDeg(leftShoulder, rightShoulder) : null
    )),
    torsoLateralOffset: normalisedMeasurement([
      'left_shoulder', 'right_shoulder', sideLandmark(supportingSide, 'hip'),
    ], torsoLength, reliability, (torso) => shoulderMidpoint && supportHip
      ? ((shoulderMidpoint.x - supportHip.x) * (supportingSide === 'left' ? 1 : -1)) / torso
      : null),
    workingAnkleToSupportingKnee: normalisedMeasurement([
      sideLandmark(workingSide, 'ankle'), sideLandmark(supportingSide, 'knee'),
    ], torsoLength, reliability, (torso) => workingAnkle && supportKnee
      ? normalisedDistance(workingAnkle, supportKnee, torso)
      : null),
    workingKneeLateralOffset: normalisedMeasurement([
      sideLandmark(workingSide, 'knee'), sideLandmark(supportingSide, 'hip'),
    ], torsoLength, reliability, (torso) => normalisedHorizontalOffset(workingKnee, supportHip, torso)),
    workingKneeHeightFromHip: normalisedMeasurement([
      sideLandmark(workingSide, 'hip'), sideLandmark(workingSide, 'knee'),
    ], torsoLength, reliability, (torso) => normalisedHeight(workingHip, workingKnee, torso)),
    workingAnkleHeightFromHip: normalisedMeasurement([
      sideLandmark(supportingSide, 'hip'), sideLandmark(workingSide, 'ankle'),
    ], torsoLength, reliability, (torso) => normalisedHeight(supportHip, workingAnkle, torso)),
    workingFootPointAngle: measurement([
      sideLandmark(workingSide, 'knee'),
      sideLandmark(workingSide, 'ankle'),
      sideLandmark(workingSide, 'foot_index'),
    ], reliability, () => threePointAngle(
      points,
      sideLandmark(workingSide, 'knee'),
      sideLandmark(workingSide, 'ankle'),
      sideLandmark(workingSide, 'foot_index'),
    )),
    workingHeelDepthCue: normalisedMeasurement([
      sideLandmark(workingSide, 'heel'), sideLandmark(workingSide, 'foot_index'),
    ], frontalBodyWidth, reliability, (bodyWidth) => {
      const heelDepth = depth(points, sideLandmark(workingSide, 'heel'));
      const toeDepth = depth(points, sideLandmark(workingSide, 'foot_index'));
      return heelDepth !== null && toeDepth !== null ? (toeDepth - heelDepth) / bodyWidth : null;
    }),
    workingHeelVisibilityCue: view === 'front'
      ? normalisedMeasurement([
        sideLandmark(supportingSide, 'hip'), sideLandmark(workingSide, 'hip'),
        sideLandmark(workingSide, 'heel'), sideLandmark(workingSide, 'foot_index'),
      ], frontalBodyWidth, reliability, (bodyWidth) => {
        if (!supportHip || !workingHip || !workingHeel || !workingFootIndex) return null;
        const outwardDirection = Math.sign(workingHip.x - supportHip.x);
        return outwardDirection === 0
          ? null
          : ((workingFootIndex.x - workingHeel.x) * outwardDirection) / bodyWidth;
      })
      : unsupportedViewMeasurement(uniqueEvidence([
        sideLandmark(supportingSide, 'hip'), sideLandmark(workingSide, 'hip'),
        sideLandmark(workingSide, 'heel'), sideLandmark(workingSide, 'foot_index'),
      ], frontalBodyWidth.evidence), reliability),
    workingAnkleOutwardOffset: normalisedMeasurement([
      sideLandmark(supportingSide, 'hip'),
      sideLandmark(workingSide, 'hip'),
      sideLandmark(workingSide, 'ankle'),
    ], torsoLength, reliability, (torso) => {
      if (!supportHip || !workingHip || !workingAnkle) return null;
      const outwardDirection = Math.sign(workingHip.x - supportHip.x);
      return outwardDirection === 0
        ? null
        : ((workingAnkle.x - workingHip.x) * outwardDirection) / torso;
    }),
    workingFootHeightFromSupportingFoot: normalisedMeasurement([
      sideLandmark(supportingSide, 'foot_index'), sideLandmark(workingSide, 'foot_index'),
    ], torsoLength, reliability, (torso) => supportingFootIndex && workingFootIndex
      ? Math.abs(supportingFootIndex.y - workingFootIndex.y) / torso
      : null),
    croiseCrossingSeparation: normalisedMeasurement([
      sideLandmark(supportingSide, 'hip'), sideLandmark(workingSide, 'hip'),
      sideLandmark(supportingSide, 'ankle'), sideLandmark(workingSide, 'ankle'),
    ], torsoLength, reliability, (torso) => {
      if (!supportHip || !workingHip || !supportAnkle || !workingAnkle) return null;
      const supportingDirection = Math.sign(supportHip.x - workingHip.x);
      return supportingDirection === 0
        ? null
        : ((workingAnkle.x - supportAnkle.x) * supportingDirection) / torso;
    }),
    frontalSupportingHipAnkleOffset: view === 'front'
      ? normalisedMeasurement([
        sideLandmark(supportingSide, 'hip'), sideLandmark(supportingSide, 'ankle'),
      ], torsoLength, reliability, (torso) => normalisedHorizontalOffset(supportHip, supportAnkle, torso))
      : unsupportedViewMeasurement(uniqueEvidence([
        sideLandmark(supportingSide, 'hip'), sideLandmark(supportingSide, 'ankle'),
      ], torsoLength.evidence), reliability),
    leftElbowAngle: measurement(['left_shoulder', 'left_elbow', 'left_wrist'], reliability, () => (
      threePointAngle(points, 'left_shoulder', 'left_elbow', 'left_wrist')
    )),
    rightElbowAngle: measurement(['right_shoulder', 'right_elbow', 'right_wrist'], reliability, () => (
      threePointAngle(points, 'right_shoulder', 'right_elbow', 'right_wrist')
    )),
    headTiltFromTorso: measurement([
      'nose', 'left_shoulder', 'right_shoulder', 'left_hip', 'right_hip',
    ], reliability, () => axisDifference(
      nose && shoulderMidpoint ? slopeDeg(nose, shoulderMidpoint) : null,
      shoulderMidpoint && hipMidpoint ? slopeDeg(shoulderMidpoint, hipMidpoint) : null,
    )),
  };
}

import { describe, expect, it } from 'vitest';
import fixtureJSON from '../../tests/fixtures/ios-domain-parity.json';
import { landmarkNames, type LandmarkName } from '../domain/landmarks';
import type {
  Landmark,
  LandmarkReliability,
  LandmarkReliabilityMap,
  MeasurementSet,
  ReliabilityReason,
  SupportingSide,
  ViewType,
} from '../domain/types';
import { angleDeg, distance, midpoint, normalisedDistance, slopeDeg, type Point } from './geometry';
import { measurePose } from './measurePose';

type Transform = 'none' | 'mirror' | 'collapse';
type MeasurementName = keyof MeasurementSet;

interface GeometryCase {
  id: string;
  operation: 'distance' | 'midpoint' | 'angleDegrees' | 'slopeDegrees' | 'normalizedDistance';
  a: Point;
  b: Point;
  vertex?: Point;
  scale?: number;
  expected?: number | null;
  expectedPoint?: Point;
}

interface MeasurementCase {
  id: string;
  supportingSide: SupportingSide;
  view: ViewType;
  sourceSize: { width: number; height: number };
  transform: Transform;
  omittedLandmarks: LandmarkName[];
  expectedValues: Record<MeasurementName, number | null>;
  expectedUnassessableReasons: Partial<Record<MeasurementName, ReliabilityReason>>;
  expectedLowConfidence: MeasurementName[];
}

interface Fixture {
  geometryCases: GeometryCase[];
  baseLandmarks: Landmark[];
  measurementCases: MeasurementCase[];
}

const fixture = fixtureJSON as unknown as Fixture;
const measurementNames: MeasurementName[] = [
  'torsoLength',
  'supportingKneeAngle',
  'supportingKneeForwardDepthCue',
  'workingKneeAngle',
  'workingKneeForwardDepthCue',
  'pelvisSlope',
  'shoulderSlope',
  'torsoLateralOffset',
  'workingAnkleToSupportingKnee',
  'workingKneeLateralOffset',
  'workingKneeHeightFromHip',
  'workingAnkleHeightFromHip',
  'workingFootPointAngle',
  'workingHeelDepthCue',
  'workingHeelVisibilityCue',
  'workingAnkleOutwardOffset',
  'workingFootHeightFromSupportingFoot',
  'croiseCrossingSeparation',
  'frontalSupportingHipAnkleOffset',
  'leftElbowAngle',
  'rightElbowAngle',
  'headTiltFromTorso',
];

function landmarksFor(testCase: MeasurementCase): Landmark[] {
  const omittedNames = new Set(testCase.omittedLandmarks);
  return fixture.baseLandmarks
    .map((landmark): Landmark => {
      if (testCase.transform === 'collapse') return { ...landmark, x: 0.5, y: 0.5, z: 0.1 };
      if (testCase.transform !== 'mirror') return landmark;
      return {
        ...landmark,
        x: 1 - landmark.x,
        name: landmark.name.replace(/^left|^right/, (side) => side === 'left' ? 'right' : 'left') as LandmarkName,
      };
    })
    .filter((landmark) => !omittedNames.has(landmark.name));
}

function reliabilityFor(landmarks: readonly Landmark[]): LandmarkReliabilityMap {
  const present = new Set(landmarks.map((landmark) => landmark.name));
  return new Map(landmarkNames.map((name): [LandmarkName, LandmarkReliability] => [
    name,
    present.has(name)
      ? { name, confidence: 'high', assessability: 'assessable', reasons: [] }
      : { name, confidence: 'low', assessability: 'unassessable', reasons: ['missing'] },
  ]));
}

describe('iOS domain parity fixture', () => {
  it('pins geometry operations to the committed fixture', () => {
    for (const testCase of fixture.geometryCases) {
      let actual: number | Point | null;
      switch (testCase.operation) {
        case 'distance':
          actual = distance(testCase.a, testCase.b);
          break;
        case 'midpoint':
          actual = midpoint(testCase.a, testCase.b);
          break;
        case 'angleDegrees':
          actual = angleDeg(testCase.a, testCase.vertex!, testCase.b);
          break;
        case 'slopeDegrees':
          actual = slopeDeg(testCase.a, testCase.b);
          break;
        case 'normalizedDistance':
          actual = normalisedDistance(testCase.a, testCase.b, testCase.scale!);
          break;
      }

      if (testCase.expectedPoint) {
        expect(actual, testCase.id).toEqual(testCase.expectedPoint);
      } else if (testCase.expected === null) {
        expect(actual, testCase.id).toBeNull();
      } else {
        expect(actual as number, testCase.id).toBeCloseTo(testCase.expected!, 6);
      }
    }
  });

  it('pins every measurement field to the existing Web implementation', () => {
    for (const testCase of fixture.measurementCases) {
      const landmarks = landmarksFor(testCase);
      const actual = measurePose(
        landmarks,
        testCase.supportingSide,
        reliabilityFor(landmarks),
        testCase.view,
        testCase.sourceSize.width,
        testCase.sourceSize.height,
      );

      expect(Object.keys(testCase.expectedValues).sort(), testCase.id)
        .toEqual([...measurementNames].sort());

      for (const name of measurementNames) {
        const expectedValue = testCase.expectedValues[name];
        const expectedReason = testCase.expectedUnassessableReasons[name];
        const measurement = actual[name];

        if (expectedValue === null) expect(measurement.value, `${testCase.id}.${name}`).toBeNull();
        else expect(measurement.value!, `${testCase.id}.${name}`).toBeCloseTo(expectedValue, 6);

        expect(measurement.assessability, `${testCase.id}.${name}`)
          .toBe(expectedReason ? 'unassessable' : 'assessable');
        expect(measurement.reason, `${testCase.id}.${name}`).toBe(expectedReason);
        expect(measurement.confidence, `${testCase.id}.${name}`)
          .toBe(testCase.expectedLowConfidence.includes(name) ? 'low' : 'high');
      }
    }
  });
});

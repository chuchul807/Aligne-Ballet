import { describe, expect, it } from 'vitest';
import fixtureJSON from '../../tests/fixtures/ios-domain-parity.json';
import { landmarkNames, type LandmarkName } from '../domain/landmarks';
import type {
  BodyRegion,
  Landmark,
  LandmarkReliability,
  LandmarkReliabilityMap,
  MeasurementSet,
  ReliabilityReason,
  SupportingSide,
  PoseName,
  Priority,
  ViewType,
} from '../domain/types';
import { angleDeg, distance, midpoint, normalisedDistance, slopeDeg, type Point } from './geometry';
import { measurePose } from './measurePose';
import { COMMON_RULES } from '../rules/commonRules';
import { ARABESQUE_RULES } from '../rules/arabesqueRules';
import { ATTITUDE_RULES } from '../rules/attitudeRules';
import { RETIRE_RULES } from '../rules/retireRules';
import { A_LA_SECONDE_RULES } from '../rules/aLaSecondeRules';
import { TENDU_CROISE_RULES } from '../rules/tenduCroiseRules';
import { evaluateRules } from '../rules/evaluateRules';
import { composeFeedback } from '../feedback/composeFeedback';

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
  ruleCases: RuleCase[];
}

interface RuleCase {
  id: string;
  position: PoseName;
  view: ViewType;
  boundary: Partial<Record<MeasurementName, number>>;
  trigger: Partial<Record<MeasurementName, number>>;
  direction: string;
  region: BodyRegion;
  priority: Priority;
  dedupeKey?: string;
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

  it('pins all five positions and common rule thresholds for both support sides', () => {
    const rules = [
      ...COMMON_RULES,
      ...ARABESQUE_RULES,
      ...ATTITUDE_RULES,
      ...RETIRE_RULES,
      ...A_LA_SECONDE_RULES,
      ...TENDU_CROISE_RULES,
    ];
    expect(fixture.ruleCases).toHaveLength(rules.length);
    expect(new Set(fixture.ruleCases.map((item) => item.id)).size).toBe(rules.length);

    for (const scenario of fixture.ruleCases) {
      const rule = rules.find((candidate) => candidate.id === scenario.id);
      expect(rule, scenario.id).toBeDefined();
      for (const supportingSide of ['left', 'right'] as const) {
        const landmarks = fixture.baseLandmarks.map((landmark): Landmark => supportingSide === 'left'
          ? landmark
          : {
            ...landmark,
            x: 1 - landmark.x,
            name: landmark.name.replace(/^left|^right/, (side) => side === 'left' ? 'right' : 'left') as LandmarkName,
          });
        const reliability = reliabilityFor(landmarks);
        const base = measurePose(landmarks, supportingSide, reliability, scenario.view, 1000, 2000);
        const withValues = (overrides: RuleCase['trigger'], medium = false): MeasurementSet => ({
          ...base,
          ...Object.fromEntries(Object.entries(overrides).map(([name, value], index) => [
            name,
            { ...base[name as MeasurementName], value, assessability: 'assessable', confidence: medium && index === 0 ? 'medium' : 'high' },
          ])),
        });
        const evaluate = (overrides: RuleCase['trigger'], medium = false, view = scenario.view) => evaluateRules(
          [rule!],
          { position: scenario.position, supportingSide, view, landmarks, reliability, measurements: withValues(overrides, medium) },
        ).find((item) => item.ruleId === scenario.id);

        expect(evaluate(scenario.boundary), `${scenario.id}.${supportingSide}.boundary`).toBeUndefined();
        const finding = evaluate(scenario.trigger);
        expect(finding, `${scenario.id}.${supportingSide}.trigger`).toMatchObject({
          ruleId: scenario.id,
          dedupeKey: scenario.dedupeKey ?? scenario.id,
          region: scenario.region,
          priority: scenario.priority,
          direction: scenario.direction,
          assessability: 'assessable',
          confidence: 'high',
        });
        expect(finding?.severity, `${scenario.id}.${supportingSide}.severity`).toBeGreaterThan(0);

        const mediumFinding = evaluate(scenario.trigger, true);
        expect(mediumFinding?.confidence, `${scenario.id}.${supportingSide}.medium`).toBe('medium');
        const coverage = Object.fromEntries(
          ['supporting-leg', 'working-leg', 'pelvis', 'torso', 'shoulders-arms', 'head', 'feet']
            .map((region) => [region, 'assessable']),
        ) as Record<BodyRegion, 'assessable'>;
        expect(composeFeedback(mediumFinding ? [mediumFinding] : [], coverage).topCorrections).toHaveLength(0);

        if (rule?.supportedViews) {
          const wrongView = scenario.view === 'front' ? 'three-quarter-side' : 'front';
          expect(evaluate(scenario.trigger, false, wrongView)?.assessability).toBe('unassessable');
        }
      }
    }
  });
});

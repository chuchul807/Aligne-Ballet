import { measurePose, type MeasurementSet } from '../analysis/measurePose';
import { buildAnnotationCommands } from '../annotation/buildCommands';
import { createSessionId } from '../domain/createSessionId';
import type { LandmarkName } from '../domain/landmarks';
import type { BodyRegion, DrawingCommand, Landmark, LandmarkReliabilityMap, Observation, AnalysisResult, PoseName, SupportingSide, ViewType } from '../domain/types';
import { composeFeedback, type FeedbackSummary } from '../feedback/composeFeedback';
import { decodeImage, type DecodedImage } from '../image/decodeImage';
import { measureImageMetrics, type ImageMetrics } from '../image/imageMetrics';
import type { PoseDetector } from '../pose/PoseDetector';
import { calculateFocusRect } from '../pose/focusedCrop';
import { refinePoseDetection } from '../pose/refinePoseDetection';
import { apparentViewRatio, evaluateQuality } from '../quality/evaluateQuality';
import { evaluateLandmarkReliability } from '../reliability/evaluateLandmarkReliability';
import { QUALITY_MESSAGES } from '../quality/messages';
import type { QualityReport } from '../quality/types';
import { ATTITUDE_RULES } from '../rules/attitudeRules';
import { A_LA_SECONDE_RULES } from '../rules/aLaSecondeRules';
import { ARABESQUE_RULES } from '../rules/arabesqueRules';
import { COMMON_RULES } from '../rules/commonRules';
import { evaluateRules } from '../rules/evaluateRules';
import { deduplicateObservations } from '../rules/deduplicateObservations';
import { RETIRE_RULES } from '../rules/retireRules';
import { TENDU_CROISE_RULES } from '../rules/tenduCroiseRules';
import type { Rule, RuleContext } from '../rules/types';

export interface AnalysisRequest {
  file: File;
  position: PoseName;
  supportingSide: SupportingSide;
  expectedView: ViewType;
  debug?: boolean;
}

export interface PassDiagnostics {
  people: number;
  cameraViewRatio: number | null;
  landmarks: Partial<Record<LandmarkName, Pick<Landmark, 'x' | 'y' | 'visibility' | 'presence'>>>;
}

export interface AnalysisDiagnostics {
  image?: {
    width: number;
    height: number;
    originalWidth: number;
    originalHeight: number;
    wasResized: boolean;
    metrics: ImageMetrics;
  };
  focusRect?: ReturnType<typeof calculateFocusRect>;
  whole?: PassDiagnostics;
  initialQuality?: { status: QualityReport['status']; reasons: readonly string[] };
  refined?: PassDiagnostics & { disagreements: readonly LandmarkName[] };
  refinedStatus?: string;
  refinedQuality?: { status: QualityReport['status']; reasons: readonly string[] };
  finalStatus?: string;
  error?: string;
}

export type AnalysisOutcome = (
  | { status: 'retake'; quality: QualityReport }
  | { status: 'success'; quality: QualityReport; result: AnalysisResult; decoded: DecodedImage }
  | { status: 'error'; message: 'Analysis could not be completed. Please try again.' }
) & { diagnostics?: AnalysisDiagnostics };

export interface AnalysisServices {
  detector: PoseDetector;
  now?: () => string;
  decode?: (file: File) => Promise<DecodedImage>;
  metrics?: (source: CanvasImageSource, width: number, height: number) => ImageMetrics;
  quality?: typeof evaluateQuality;
  refine?: typeof refinePoseDetection;
  reliability?: typeof evaluateLandmarkReliability;
  measure?: (landmarks: readonly Landmark[], supportingSide: SupportingSide, reliability: LandmarkReliabilityMap, view: ViewType, sourceWidth: number, sourceHeight: number) => MeasurementSet;
  evaluate?: (rules: readonly Rule[], context: RuleContext) => readonly Observation[];
  deduplicate?: typeof deduplicateObservations;
  feedback?: (observations: readonly Observation[], coverage: Parameters<typeof composeFeedback>[1]) => FeedbackSummary;
  annotations?: (observations: readonly Observation[], landmarks: readonly Landmark[], reliability: LandmarkReliabilityMap, supportingSide: SupportingSide) => readonly DrawingCommand[];
}

function rulesFor(position: PoseName): readonly Rule[] {
  const rulesByPosition: Readonly<Record<PoseName, readonly Rule[]>> = {
    arabesque: ARABESQUE_RULES,
    'attitude-derriere': ATTITUDE_RULES,
    'retire-passe': RETIRE_RULES,
    'a-la-seconde': A_LA_SECONDE_RULES,
    'tendu-croise-devant': TENDU_CROISE_RULES,
  };
  const positionRules = rulesByPosition[position];
  return [...COMMON_RULES, ...positionRules];
}

const DIAGNOSTIC_LANDMARKS = [
  'nose',
  'left_shoulder', 'right_shoulder',
  'left_hip', 'right_hip',
  'left_knee', 'right_knee',
  'left_ankle', 'right_ankle',
  'left_heel', 'right_heel',
  'left_foot_index', 'right_foot_index',
] as const satisfies readonly LandmarkName[];

function passDiagnostics(landmarkSet: { people: readonly (readonly Landmark[])[] }): PassDiagnostics {
  const person = landmarkSet.people[0];
  const points = new Map(person?.map((landmark) => [landmark.name, landmark]) ?? []);
  const landmarks = Object.fromEntries(DIAGNOSTIC_LANDMARKS.flatMap((name) => {
    const point = points.get(name);
    return point ? [[name, {
      x: point.x,
      y: point.y,
      visibility: point.visibility,
      ...(point.presence === undefined ? {} : { presence: point.presence }),
    }]] : [];
  }));
  return {
    people: landmarkSet.people.length,
    cameraViewRatio: person ? apparentViewRatio(points) : null,
    landmarks,
  };
}

function qualityDiagnostics(report: QualityReport) {
  return { status: report.status, reasons: report.reasons.map((reason) => reason.code) };
}

function withDiagnostics<T extends Exclude<AnalysisOutcome, undefined>>(
  outcome: T,
  diagnostics: AnalysisDiagnostics | undefined,
): T {
  return diagnostics ? { ...outcome, diagnostics } : outcome;
}

export interface ViabilityRequirement {
  region: BodyRegion;
  measurements: readonly (keyof MeasurementSet)[];
  minimumAssessable: number;
}

export interface ViabilityQuorum {
  requirements: readonly ViabilityRequirement[];
  minimumSatisfiedRequirements: number;
}

export interface PositionViabilityConfiguration {
  /** General alignment evidence; one isolated missing core region remains usable. */
  core: ViabilityQuorum;
  /** Evidence that is specific enough to say something about the selected position. */
  positionSpecific: ViabilityQuorum;
}

const CORE_VIABILITY_REQUIREMENTS = [
  { region: 'torso', measurements: ['torsoLength'], minimumAssessable: 1 },
  { region: 'supporting-leg', measurements: ['supportingKneeAngle'], minimumAssessable: 1 },
  { region: 'pelvis', measurements: ['pelvisSlope'], minimumAssessable: 1 },
] as const satisfies readonly ViabilityRequirement[];

export const POSITION_VIABILITY_CONFIG = {
  arabesque: {
    core: { requirements: CORE_VIABILITY_REQUIREMENTS, minimumSatisfiedRequirements: 2 },
    positionSpecific: {
      requirements: [
        { region: 'working-leg', measurements: ['workingKneeAngle', 'workingAnkleHeightFromHip'], minimumAssessable: 1 },
      ],
      minimumSatisfiedRequirements: 1,
    },
  },
  'attitude-derriere': {
    core: { requirements: CORE_VIABILITY_REQUIREMENTS, minimumSatisfiedRequirements: 2 },
    positionSpecific: {
      requirements: [
        { region: 'working-leg', measurements: ['workingKneeAngle', 'workingKneeHeightFromHip'], minimumAssessable: 1 },
      ],
      minimumSatisfiedRequirements: 1,
    },
  },
  'retire-passe': {
    core: { requirements: CORE_VIABILITY_REQUIREMENTS, minimumSatisfiedRequirements: 2 },
    positionSpecific: {
      requirements: [
        { region: 'working-leg', measurements: ['workingKneeLateralOffset'], minimumAssessable: 1 },
        { region: 'feet', measurements: ['workingAnkleToSupportingKnee'], minimumAssessable: 1 },
      ],
      minimumSatisfiedRequirements: 1,
    },
  },
  'a-la-seconde': {
    core: { requirements: CORE_VIABILITY_REQUIREMENTS, minimumSatisfiedRequirements: 2 },
    positionSpecific: {
      requirements: [
        { region: 'working-leg', measurements: ['workingKneeAngle', 'workingAnkleOutwardOffset'], minimumAssessable: 1 },
        { region: 'feet', measurements: ['workingFootPointAngle', 'workingHeelVisibilityCue'], minimumAssessable: 1 },
      ],
      minimumSatisfiedRequirements: 1,
    },
  },
  'tendu-croise-devant': {
    core: { requirements: CORE_VIABILITY_REQUIREMENTS, minimumSatisfiedRequirements: 2 },
    positionSpecific: {
      requirements: [
        { region: 'working-leg', measurements: ['workingKneeAngle', 'croiseCrossingSeparation'], minimumAssessable: 1 },
        { region: 'feet', measurements: ['workingFootPointAngle', 'workingFootHeightFromSupportingFoot'], minimumAssessable: 1 },
      ],
      minimumSatisfiedRequirements: 1,
    },
  },
} as const satisfies Readonly<Record<PoseName, PositionViabilityConfiguration>>;

function requirementIsSatisfied(requirement: ViabilityRequirement, measurements: MeasurementSet): boolean {
  const assessable = requirement.measurements.filter((name) => {
    const measurement = measurements[name];
    return measurement.assessability === 'assessable'
      && measurement.value !== null
      && Number.isFinite(measurement.value);
  }).length;
  return assessable >= requirement.minimumAssessable;
}

function evaluateViability(position: PoseName, measurements: MeasurementSet): {
  viable: boolean;
  unavailableRegions: readonly BodyRegion[];
} {
  const config = POSITION_VIABILITY_CONFIG[position];
  const coreSatisfied = config.core.requirements.filter((requirement) => (
    requirementIsSatisfied(requirement, measurements)
  )).length;
  const positionSatisfied = config.positionSpecific.requirements.filter((requirement) => (
    requirementIsSatisfied(requirement, measurements)
  )).length;
  const unavailableRegions = [...config.core.requirements, ...config.positionSpecific.requirements]
    .filter((requirement) => !requirementIsSatisfied(requirement, measurements))
    .map((requirement) => requirement.region);

  return {
    viable: coreSatisfied >= config.core.minimumSatisfiedRequirements
      && positionSatisfied >= config.positionSpecific.minimumSatisfiedRequirements,
    unavailableRegions: [...new Set(unavailableRegions)],
  };
}

function selectedObservations(observations: readonly Observation[], feedback: FeedbackSummary): readonly Observation[] {
  const byId = new Map(observations.map((observation) => [observation.id, observation]));
  return feedback.topCorrections.flatMap((item) => {
    const observation = byId.get(item.observationId);
    return observation ? [observation] : [];
  });
}

function disagreementRegions(disagreements: ReadonlySet<LandmarkName>, supportingSide: SupportingSide): readonly BodyRegion[] {
  const leftLeg = supportingSide === 'left' ? 'supporting-leg' : 'working-leg';
  const rightLeg = supportingSide === 'right' ? 'supporting-leg' : 'working-leg';
  const regions: Record<LandmarkName, readonly BodyRegion[]> = {
    nose: ['head'],
    left_eye_inner: ['head'], left_eye: ['head'], left_eye_outer: ['head'],
    right_eye_inner: ['head'], right_eye: ['head'], right_eye_outer: ['head'],
    left_ear: ['head'], right_ear: ['head'], mouth_left: ['head'], mouth_right: ['head'],
    left_shoulder: ['shoulders-arms', 'torso'], right_shoulder: ['shoulders-arms', 'torso'],
    left_elbow: ['shoulders-arms'], right_elbow: ['shoulders-arms'],
    left_wrist: ['shoulders-arms'], right_wrist: ['shoulders-arms'],
    left_pinky: ['shoulders-arms'], right_pinky: ['shoulders-arms'],
    left_index: ['shoulders-arms'], right_index: ['shoulders-arms'],
    left_thumb: ['shoulders-arms'], right_thumb: ['shoulders-arms'],
    left_hip: ['pelvis', 'torso', leftLeg], right_hip: ['pelvis', 'torso', rightLeg],
    left_knee: [leftLeg], right_knee: [rightLeg],
    left_ankle: [leftLeg, 'feet'], right_ankle: [rightLeg, 'feet'],
    left_heel: ['feet'], right_heel: ['feet'],
    left_foot_index: ['feet'], right_foot_index: ['feet'],
  };
  return [...disagreements].flatMap((name) => regions[name]);
}

function imageRetake(error: unknown): QualityReport | null {
  const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : null;
  if (code !== 'image-too-small'
    && code !== 'normalisation-failed'
    && code !== 'image-memory-failed'
    && code !== 'decode-failed') return null;
  return { status: 'fail', reasons: [{ code, message: QUALITY_MESSAGES[code] }], unassessableRegions: [] };
}

/** Decodes/measures once, detects whole-image and focused poses, and transfers decoded ownership on success. */
export async function analyzePose(request: AnalysisRequest, services: AnalysisServices): Promise<AnalysisOutcome> {
  const decode = services.decode ?? decodeImage;
  const metrics = services.metrics ?? measureImageMetrics;
  const quality = services.quality ?? evaluateQuality;
  const refine = services.refine ?? refinePoseDetection;
  const reliabilityFor = services.reliability ?? evaluateLandmarkReliability;
  const measure = services.measure ?? measurePose;
  const evaluate = services.evaluate ?? evaluateRules;
  const deduplicate = services.deduplicate ?? deduplicateObservations;
  const feedback = services.feedback ?? composeFeedback;
  const annotations = services.annotations ?? buildAnnotationCommands;
  const now = services.now ?? (() => new Date().toISOString());
  const diagnostics: AnalysisDiagnostics | undefined = request.debug ? {} : undefined;
  let decoded: DecodedImage | null = null;

  try {
    decoded = await decode(request.file);
    const pixelMetrics = metrics(decoded.source, decoded.width, decoded.height);
    if (diagnostics) {
      diagnostics.image = {
        width: decoded.width,
        height: decoded.height,
        originalWidth: decoded.normalisation.originalWidth,
        originalHeight: decoded.normalisation.originalHeight,
        wasResized: decoded.normalisation.wasResized,
        metrics: pixelMetrics,
      };
    }
    const wholeLandmarks = await services.detector.detect(decoded.source, decoded.width, decoded.height);
    if (diagnostics) {
      diagnostics.whole = passDiagnostics(wholeLandmarks);
      diagnostics.focusRect = wholeLandmarks.people[0]
        ? calculateFocusRect(wholeLandmarks.people[0], decoded.width, decoded.height)
        : null;
    }
    const initialQuality = quality({
      landmarks: wholeLandmarks,
      position: request.position,
      supportingSide: request.supportingSide,
      expectedView: request.expectedView,
      metrics: pixelMetrics,
      requiredJointVisibility: 'defer',
    });

    const initialQualityReport: QualityReport = {
      ...initialQuality,
      imageWasResized: decoded.normalisation.wasResized,
    };
    if (diagnostics) diagnostics.initialQuality = qualityDiagnostics(initialQualityReport);

    if (initialQualityReport.status === 'fail') {
      if (diagnostics) diagnostics.finalStatus = 'initial-quality-fail';
      decoded.dispose();
      return withDiagnostics({ status: 'retake', quality: initialQualityReport }, diagnostics);
    }

    const refined = await refine({
      whole: wholeLandmarks,
      source: decoded.source,
      width: decoded.width,
      height: decoded.height,
      detector: services.detector,
    });
    if (refined.status !== 'success') {
      if (diagnostics) {
        diagnostics.refinedStatus = refined.status;
        diagnostics.finalStatus = 'refinement-fail';
      }
      decoded.dispose();
      return withDiagnostics({
        status: 'retake',
        quality: {
          status: 'fail',
          reasons: [{ code: refined.status, message: QUALITY_MESSAGES[refined.status] }],
          unassessableRegions: initialQualityReport.unassessableRegions,
          imageWasResized: decoded.normalisation.wasResized,
        },
      }, diagnostics);
    }
    if (diagnostics) {
      diagnostics.refinedStatus = 'success';
      diagnostics.refined = {
        ...passDiagnostics(refined.landmarks),
        disagreements: [...refined.disagreements],
      };
    }

    const refinedQuality = quality({
      landmarks: refined.landmarks,
      position: request.position,
      supportingSide: request.supportingSide,
      expectedView: request.expectedView,
      metrics: pixelMetrics,
      requiredJointVisibility: 'enforce',
      cameraViewCheck: 'defer',
    });
    const qualityCoverage = [...new Set([
      ...initialQualityReport.unassessableRegions,
      ...refinedQuality.unassessableRegions,
    ])];
    const qualityReport: QualityReport = {
      ...refinedQuality,
      unassessableRegions: qualityCoverage,
      imageWasResized: decoded.normalisation.wasResized,
    };
    if (diagnostics) diagnostics.refinedQuality = qualityDiagnostics(qualityReport);
    if (qualityReport.status === 'fail') {
      if (diagnostics) diagnostics.finalStatus = 'refined-quality-fail';
      decoded.dispose();
      return withDiagnostics({ status: 'retake', quality: qualityReport }, diagnostics);
    }

    const landmarks = refined.landmarks.people[0];
    if (!landmarks) {
      if (diagnostics) diagnostics.finalStatus = 'missing-refined-person';
      decoded.dispose();
      return withDiagnostics({ status: 'error', message: 'Analysis could not be completed. Please try again.' }, diagnostics);
    }
    const reliability = reliabilityFor(landmarks, request.expectedView, refined.disagreements);
    const measurements = measure(
      landmarks,
      request.supportingSide,
      reliability,
      request.expectedView,
      decoded.width,
      decoded.height,
    );
    const viability = evaluateViability(request.position, measurements);
    const combinedCoverage = [...new Set([
      ...qualityCoverage,
      ...viability.unavailableRegions,
      ...disagreementRegions(refined.disagreements, request.supportingSide),
    ])];
    if (!viability.viable) {
      const code = refined.disagreements.size > 0
        ? 'unstable-pose-landmarks'
        : 'insufficient-pose-evidence';
      if (diagnostics) diagnostics.finalStatus = code;
      decoded.dispose();
      return withDiagnostics({
        status: 'retake',
        quality: {
          status: 'fail',
          reasons: [{
            code,
            message: QUALITY_MESSAGES[code],
          }],
          unassessableRegions: combinedCoverage,
          imageWasResized: decoded.normalisation.wasResized,
        },
      }, diagnostics);
    }
    const analysisQualityReport: QualityReport = combinedCoverage.length === 0
      ? qualityReport
      : {
          ...qualityReport,
          status: 'partial',
          unassessableRegions: combinedCoverage,
        };
    const observations = deduplicate(evaluate(rulesFor(request.position), {
      position: request.position,
      supportingSide: request.supportingSide,
      view: request.expectedView,
      landmarks,
      reliability,
      measurements,
    }));
    const summary = feedback(observations, Object.fromEntries(
      ['supporting-leg', 'working-leg', 'pelvis', 'torso', 'shoulders-arms', 'head', 'feet'].map((region) => [
        region,
        analysisQualityReport.unassessableRegions.includes(region as import('../domain/types').BodyRegion)
          ? 'unassessable'
          : 'assessable',
      ]),
    ) as Parameters<typeof composeFeedback>[1]);
    const finalCoverage = [...new Set([
      ...analysisQualityReport.unassessableRegions,
      ...summary.fullBodyReview.filter((section) => section.status === 'unassessable').map((section) => section.region),
    ])];
    const finalQualityReport: QualityReport = finalCoverage.length === 0
      ? analysisQualityReport
      : { ...analysisQualityReport, status: 'partial', unassessableRegions: finalCoverage };
    const markedObservations = selectedObservations(observations, summary);
    const result: AnalysisResult = {
      sessionId: createSessionId(),
      position: request.position,
      landmarks,
      topCorrections: summary.topCorrections,
      fullBodyReview: summary.fullBodyReview,
      annotations: annotations(markedObservations, landmarks, reliability, request.supportingSide),
      createdAt: now(),
    };
    if (diagnostics) diagnostics.finalStatus = 'success';
    return withDiagnostics({ status: 'success', quality: finalQualityReport, result, decoded }, diagnostics);
  } catch (error) {
    decoded?.dispose();
    const quality = imageRetake(error);
    if (diagnostics) {
      diagnostics.finalStatus = quality ? 'decode-retake' : 'error';
      diagnostics.error = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    }
    if (quality) return withDiagnostics({ status: 'retake', quality }, diagnostics);
    return withDiagnostics({ status: 'error', message: 'Analysis could not be completed. Please try again.' }, diagnostics);
  }
}

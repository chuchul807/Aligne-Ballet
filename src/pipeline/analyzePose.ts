import { measurePose, type MeasurementSet } from '../analysis/measurePose';
import { buildAnnotationCommands } from '../annotation/buildCommands';
import type { DrawingCommand, Landmark, LandmarkReliabilityMap, Observation, AnalysisResult, PoseName, SupportingSide, ViewType } from '../domain/types';
import { composeFeedback, type FeedbackSummary } from '../feedback/composeFeedback';
import { decodeImage, type DecodedImage } from '../image/decodeImage';
import { measureImageMetrics, type ImageMetrics } from '../image/imageMetrics';
import type { PoseDetector } from '../pose/PoseDetector';
import { evaluateQuality } from '../quality/evaluateQuality';
import { evaluateLandmarkReliability } from '../reliability/evaluateLandmarkReliability';
import { QUALITY_MESSAGES } from '../quality/messages';
import type { QualityReport } from '../quality/types';
import { ATTITUDE_RULES } from '../rules/attitudeRules';
import { ARABESQUE_RULES } from '../rules/arabesqueRules';
import { COMMON_RULES } from '../rules/commonRules';
import { evaluateRules } from '../rules/evaluateRules';
import { deduplicateObservations } from '../rules/deduplicateObservations';
import { RETIRE_RULES } from '../rules/retireRules';
import type { Rule, RuleContext } from '../rules/types';

export interface AnalysisRequest {
  file: File;
  position: PoseName;
  supportingSide: SupportingSide;
  expectedView: ViewType;
}

export type AnalysisOutcome =
  | { status: 'retake'; quality: QualityReport }
  | { status: 'success'; quality: QualityReport; result: AnalysisResult; decoded: DecodedImage }
  | { status: 'error'; message: 'Analysis could not be completed. Please try again.' };

export interface AnalysisServices {
  detector: PoseDetector;
  now?: () => string;
  decode?: (file: File) => Promise<DecodedImage>;
  metrics?: (source: CanvasImageSource, width: number, height: number) => ImageMetrics;
  quality?: typeof evaluateQuality;
  reliability?: typeof evaluateLandmarkReliability;
  measure?: (landmarks: readonly Landmark[], supportingSide: SupportingSide, reliability: LandmarkReliabilityMap, view: ViewType) => MeasurementSet;
  evaluate?: (rules: readonly Rule[], context: RuleContext) => readonly Observation[];
  deduplicate?: typeof deduplicateObservations;
  feedback?: (observations: readonly Observation[], coverage: Parameters<typeof composeFeedback>[1]) => FeedbackSummary;
  annotations?: (observations: readonly Observation[], landmarks: readonly Landmark[], reliability: LandmarkReliabilityMap, supportingSide: SupportingSide) => readonly DrawingCommand[];
}

function rulesFor(position: PoseName): readonly Rule[] {
  const positionRules = position === 'arabesque'
    ? ARABESQUE_RULES
    : position === 'attitude-derriere'
      ? ATTITUDE_RULES
      : RETIRE_RULES;
  return [...COMMON_RULES, ...positionRules];
}

function selectedObservations(observations: readonly Observation[], feedback: FeedbackSummary): readonly Observation[] {
  const byId = new Map(observations.map((observation) => [observation.id, observation]));
  return feedback.topCorrections.flatMap((item) => {
    const observation = byId.get(item.observationId);
    return observation ? [observation] : [];
  });
}

function imageRetake(error: unknown): QualityReport | null {
  const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : null;
  if (code !== 'image-too-small' && code !== 'normalisation-failed') return null;
  return { status: 'fail', reasons: [{ code, message: QUALITY_MESSAGES[code] }], unassessableRegions: [] };
}

/** Runs every expensive browser boundary once and leaves the decoded source owned by a successful caller. */
export async function analyzePose(request: AnalysisRequest, services: AnalysisServices): Promise<AnalysisOutcome> {
  const decode = services.decode ?? decodeImage;
  const metrics = services.metrics ?? measureImageMetrics;
  const quality = services.quality ?? evaluateQuality;
  const reliabilityFor = services.reliability ?? evaluateLandmarkReliability;
  const measure = services.measure ?? measurePose;
  const evaluate = services.evaluate ?? evaluateRules;
  const deduplicate = services.deduplicate ?? deduplicateObservations;
  const feedback = services.feedback ?? composeFeedback;
  const annotations = services.annotations ?? buildAnnotationCommands;
  const now = services.now ?? (() => new Date().toISOString());
  let decoded: DecodedImage | null = null;

  try {
    decoded = await decode(request.file);
    const pixelMetrics = metrics(decoded.source, decoded.width, decoded.height);
    const landmarkSet = await services.detector.detect(decoded.source, decoded.width, decoded.height);
    const qualityResult = quality({
      landmarks: landmarkSet,
      position: request.position,
      supportingSide: request.supportingSide,
      expectedView: request.expectedView,
      metrics: pixelMetrics,
    });

    const qualityReport: QualityReport = {
      ...qualityResult,
      imageWasResized: decoded.normalisation.wasResized,
    };

    if (qualityReport.status === 'fail') {
      decoded.dispose();
      return { status: 'retake', quality: qualityReport };
    }

    const landmarks = landmarkSet.people[0];
    if (!landmarks) {
      decoded.dispose();
      return { status: 'error', message: 'Analysis could not be completed. Please try again.' };
    }
    const reliability = reliabilityFor(landmarks, request.expectedView);
    const measurements = measure(landmarks, request.supportingSide, reliability, request.expectedView);
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
        qualityReport.unassessableRegions.includes(region as import('../domain/types').BodyRegion)
          ? 'unassessable'
          : 'assessable',
      ]),
    ) as Parameters<typeof composeFeedback>[1]);
    const markedObservations = selectedObservations(observations, summary);
    const result: AnalysisResult = {
      sessionId: crypto.randomUUID(),
      position: request.position,
      landmarks,
      topCorrections: summary.topCorrections,
      fullBodyReview: summary.fullBodyReview,
      annotations: annotations(markedObservations, landmarks, reliability, request.supportingSide),
      createdAt: now(),
    };
    return { status: 'success', quality: qualityReport, result, decoded };
  } catch (error) {
    decoded?.dispose();
    const quality = imageRetake(error);
    if (quality) return { status: 'retake', quality };
    return { status: 'error', message: 'Analysis could not be completed. Please try again.' };
  }
}

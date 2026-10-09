import { useEffect, useReducer, useRef, useState } from 'react';
import type { DecodedImage } from '../image/decodeImage';
import type { AnalysisResult, PoseName, SupportingSide, ViewType } from '../domain/types';
import { createMediaPipePoseDetector } from '../pose/MediaPipePoseDetector';
import type { PoseDetector } from '../pose/PoseDetector';
import { analyzePose, type AnalysisServices } from '../pipeline/analyzePose';
import { initialSessionState, sessionReducer } from '../session/sessionReducer';
import { CheckCard } from '../ui/CheckCard';
import { FrameCard } from '../ui/FrameCard';
import { ResultCard } from '../ui/ResultCard';
import { SelectCard } from '../ui/SelectCard';
import { StepTabs } from '../ui/StepTabs';

export interface AppServices {
  createDetector(): Promise<PoseDetector>;
  now(): string;
  analysis?: Omit<AnalysisServices, 'detector' | 'now'>;
}

const browserServices: AppServices = { createDetector: createMediaPipePoseDetector, now: () => new Date().toISOString() };
const frontViewPositions = new Set<PoseName>([
  'retire-passe',
  'a-la-seconde',
  'tendu-croise-devant',
]);
const viewFor = (position: PoseName): ViewType => frontViewPositions.has(position) ? 'front' : 'three-quarter-side';

export function App({ services = browserServices }: { services?: AppServices }) {
  const debugMode = new URLSearchParams(window.location.search).get('debug') === '1';
  const [session, dispatch] = useReducer(sessionReducer, initialSessionState);
  const [position, setPosition] = useState<PoseName>('arabesque');
  const [supportingSide, setSupportingSide] = useState<SupportingSide>('left');
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [pendingResult, setPendingResult] = useState<AnalysisResult | null>(null);
  const [diagnostics, setDiagnostics] = useState<string | null>(null);
  const detector = useRef<PoseDetector | null>(null);
  const decoded = useRef<DecodedImage | null>(null);
  const previewUrl = useRef<string | null>(null);
  const generation = useRef(0);
  const mounted = useRef(true);

  const releaseImage = () => {
    decoded.current?.dispose(); decoded.current = null;
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = null;
  };
  useEffect(() => () => {
    mounted.current = false;
    generation.current += 1;
    releaseImage(); detector.current?.close(); detector.current = null;
  }, []);

  const cancelAnalysis = () => {
    generation.current += 1;
    if (mounted.current) setIsAnalysing(false);
  };

  const beginAnalysis = async (file: File) => {
    if (!session.position || !session.supportingSide) return;
    const requestGeneration = generation.current + 1;
    generation.current = requestGeneration;
    const isActive = () => mounted.current && generation.current === requestGeneration;
    setIsAnalysing(true);
    try {
      let activeDetector = detector.current;
      if (!activeDetector) {
        const createdDetector = await services.createDetector();
        if (!isActive()) { createdDetector.close(); return; }
        detector.current = createdDetector;
        activeDetector = createdDetector;
      }
      const outcome = await analyzePose({
        file,
        position: session.position,
        supportingSide: session.supportingSide,
        expectedView: viewFor(session.position),
        debug: debugMode,
      }, { detector: activeDetector, now: services.now, ...services.analysis });
      if (!isActive()) {
        if (outcome.status === 'success') outcome.decoded.dispose();
        return;
      }
      if (debugMode && outcome.diagnostics) {
        setDiagnostics(JSON.stringify({
          environment: {
            userAgent: navigator.userAgent,
            createImageBitmap: typeof globalThis.createImageBitmap === 'function',
          },
          file: { type: file.type, size: file.size },
          analysis: outcome.diagnostics,
        }, null, 2));
      }
      if (outcome.status === 'retake') dispatch({ type: 'quality-completed', report: outcome.quality });
      else if (outcome.status === 'success') {
        decoded.current?.dispose(); decoded.current = outcome.decoded;
        setPendingResult(outcome.result);
        dispatch({ type: 'quality-completed', report: outcome.quality });
      } else dispatch({ type: 'analysis-failed', message: outcome.message });
    } catch {
      if (isActive()) dispatch({ type: 'analysis-failed', message: 'Analysis could not be completed. Please try again.' });
    } finally { if (isActive()) setIsAnalysing(false); }
  };

  const selectFile = (file: File) => {
    cancelAnalysis(); releaseImage(); setPendingResult(null); setDiagnostics(null); previewUrl.current = URL.createObjectURL(file);
    dispatch({ type: 'image-selected', image: { file, previewUrl: previewUrl.current } });
    void beginAnalysis(file);
  };
  const invalidateSelection = () => {
    cancelAnalysis();
    releaseImage();
    setPendingResult(null);
  };
  const reset = () => { cancelAnalysis(); releaseImage(); setPendingResult(null); setDiagnostics(null); dispatch({ type: 'reset' }); setPosition('arabesque'); setSupportingSide('left'); };

  return <div className="app-shell"><main className="app-card" aria-label="ALIGNÉ ballet feedback">
    <header className="app-header"><p className="eyebrow">ALIGNÉ</p><h1>Practice with a clearer eye</h1><p>One focused check at a time.</p></header>
    <StepTabs stage={session.stage} unlockedStages={session.unlockedStages} onSelect={(stage) => { if (stage !== session.stage) { cancelAnalysis(); dispatch({ type: 'stage-requested', stage }); } }} />
    {session.stage === 'select' && <SelectCard position={position} supportingSide={supportingSide} onPositionChange={(next) => { invalidateSelection(); setPosition(next); dispatch({ type: 'position-changed', position: next }); }} onSupportingSideChange={(next) => { invalidateSelection(); setSupportingSide(next); dispatch({ type: 'supporting-side-changed', supportingSide: next }); }} onConfirm={() => { cancelAnalysis(); dispatch({ type: 'selection-confirmed', position, supportingSide }); }} />}
    {session.stage === 'frame' && session.position && <FrameCard view={viewFor(session.position)} onFileSelected={selectFile} />}
    {session.stage === 'check' && <>
      {isAnalysing
        ? <section className="stage-card" aria-label="Photo check"><p role="status" className="status-note">Checking your photo…</p></section>
        : session.quality
          ? <CheckCard report={session.quality} onAnalyse={() => { if (pendingResult) dispatch({ type: 'analysis-succeeded', result: pendingResult }); }} onRetake={() => { cancelAnalysis(); dispatch({ type: 'stage-requested', stage: 'frame' }); }} />
          : <section className="stage-card" aria-label="Photo check"><p role="alert">{session.error}</p>{session.image && <button className="primary-action" type="button" onClick={() => void beginAnalysis(session.image!.file)}>Try again</button>}</section>}
      {debugMode && diagnostics && (
        <section className="diagnostics-card" aria-label="Diagnostics">
          <label htmlFor="analysis-diagnostics">Analysis diagnostics</label>
          <textarea id="analysis-diagnostics" readOnly rows={14} value={diagnostics} />
        </section>
      )}
    </>}
    {session.stage === 'result' && session.result && <ResultCard result={session.result} image={decoded.current?.source ?? null} onAnotherPhoto={reset} />}
  </main></div>;
}

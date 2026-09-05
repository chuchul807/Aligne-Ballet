import { useEffect, useReducer, useRef, useState } from 'react';
import type { DecodedImage } from '../image/decodeImage';
import type { PoseName, SupportingSide, ViewType } from '../domain/types';
import type { AnalysisResult } from '../domain/types';
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
const viewFor = (position: PoseName): ViewType => position === 'retire-passe' ? 'front' : 'three-quarter-side';

export function App({ services = browserServices }: { services?: AppServices }) {
  const [session, dispatch] = useReducer(sessionReducer, initialSessionState);
  const [position, setPosition] = useState<PoseName>('arabesque');
  const [supportingSide, setSupportingSide] = useState<SupportingSide>('left');
  const [isAnalysing, setIsAnalysing] = useState(false);
  const [pendingResult, setPendingResult] = useState<AnalysisResult | null>(null);
  const detector = useRef<PoseDetector | null>(null);
  const decoded = useRef<DecodedImage | null>(null);
  const previewUrl = useRef<string | null>(null);

  const releaseImage = () => {
    decoded.current?.dispose(); decoded.current = null;
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = null;
  };
  useEffect(() => () => { releaseImage(); detector.current?.close(); detector.current = null; }, []);

  const beginAnalysis = async (file: File) => {
    if (!session.position || !session.supportingSide) return;
    setIsAnalysing(true);
    try {
      detector.current ??= await services.createDetector();
      const outcome = await analyzePose({ file, position: session.position, supportingSide: session.supportingSide, expectedView: viewFor(session.position) }, { detector: detector.current, now: services.now, ...services.analysis });
      if (outcome.status === 'retake') dispatch({ type: 'quality-completed', report: outcome.quality });
      else if (outcome.status === 'success') {
        decoded.current?.dispose(); decoded.current = outcome.decoded;
        setPendingResult(outcome.result);
        dispatch({ type: 'quality-completed', report: outcome.quality });
      } else dispatch({ type: 'analysis-failed', message: outcome.message });
    } catch {
      dispatch({ type: 'analysis-failed', message: 'Analysis could not be completed. Please try again.' });
    } finally { setIsAnalysing(false); }
  };

  const selectFile = (file: File) => {
    releaseImage(); setPendingResult(null); previewUrl.current = URL.createObjectURL(file);
    dispatch({ type: 'image-selected', image: { file, previewUrl: previewUrl.current } });
    void beginAnalysis(file);
  };
  const reset = () => { releaseImage(); setPendingResult(null); dispatch({ type: 'reset' }); setPosition('arabesque'); setSupportingSide('left'); };

  return <div className="app-shell"><main className="app-card" aria-label="ALIGNÉ ballet feedback">
    <header className="app-header"><p className="eyebrow">ALIGNÉ</p><h1>Practice with a clearer eye</h1><p>One focused check at a time.</p></header>
    <StepTabs stage={session.stage} unlockedStages={session.unlockedStages} onSelect={(stage) => dispatch({ type: 'stage-requested', stage })} />
    {session.stage === 'select' && <SelectCard position={position} supportingSide={supportingSide} onPositionChange={(next) => { setPosition(next); dispatch({ type: 'position-changed', position: next }); }} onSupportingSideChange={setSupportingSide} onConfirm={() => dispatch({ type: 'selection-confirmed', position, supportingSide })} />}
    {session.stage === 'frame' && session.position && <FrameCard view={viewFor(session.position)} onFileSelected={selectFile} />}
    {session.stage === 'check' && (isAnalysing
      ? <section className="stage-card" aria-label="Photo check"><p role="status" className="status-note">Checking your photo…</p></section>
      : session.quality
        ? <CheckCard report={session.quality} onAnalyse={() => { if (pendingResult) dispatch({ type: 'analysis-succeeded', result: pendingResult }); }} onRetake={() => dispatch({ type: 'stage-requested', stage: 'frame' })} />
        : <section className="stage-card" aria-label="Photo check"><p role="alert">{session.error}</p>{session.image && <button className="primary-action" type="button" onClick={() => void beginAnalysis(session.image!.file)}>Try again</button>}</section>)}
    {session.stage === 'result' && session.result && <ResultCard result={session.result} image={decoded.current?.source ?? null} onAnotherPhoto={reset} />}
  </main></div>;
}

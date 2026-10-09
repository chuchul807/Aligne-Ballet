import { useEffect, useRef, useState } from 'react';
import { drawAnnotatedPose } from '../annotation/drawAnnotatedPose';
import { renderDownload } from '../annotation/renderDownload';
import type { AnalysisResult, BodyRegion } from '../domain/types';
import { poseLabel } from '../domain/poseLabel';
import { Disclaimer } from './Disclaimer';

interface ResultCardProps {
  result: AnalysisResult;
  image: CanvasImageSource | null;
  onAnotherPhoto: () => void;
}

const regionLabels: Record<BodyRegion, string> = {
  'supporting-leg': 'Supporting leg', 'working-leg': 'Working leg', pelvis: 'Pelvis', torso: 'Torso',
  'shoulders-arms': 'Shoulders and arms', head: 'Head', feet: 'Feet',
};

export function ResultCard({ result, image, onAnotherPhoto }: ResultCardProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [annotationError, setAnnotationError] = useState<string | null>(null);
  const [annotationReady, setAnnotationReady] = useState(false);
  const [annotationAttempt, setAnnotationAttempt] = useState(0);
  const label = poseLabel(result.position);

  useEffect(() => {
    if (!canvas.current || !image) return;
    try {
      drawAnnotatedPose(canvas.current, image, result.landmarks, result.annotations);
      setAnnotationReady(true);
      setAnnotationError(null);
    } catch {
      setAnnotationReady(false);
      setAnnotationError('Annotated image could not be prepared. Please try again.');
    }
  }, [annotationAttempt, image, result]);

  const download = async () => {
    if (!canvas.current || !image || !annotationReady) return;
    try {
      const blob = await renderDownload({ image: canvas.current, result });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'aligne-ballet-feedback.png';
      anchor.click();
      URL.revokeObjectURL(url);
      setDownloadError(null);
    } catch {
      setDownloadError('Your result could not be downloaded. Please try again.');
    }
  };

  return (
    <section className="stage-card result-card" aria-label="Your feedback">
      <p className="stage-kicker">Step 4 of 4</p>
      <h2>Your feedback</h2>
      {image && <canvas className="annotated-pose" ref={canvas} hidden={!annotationReady} role={annotationReady ? 'img' : undefined} aria-label={annotationReady ? `Annotated ${label} pose with highlighted corrections` : undefined} />}
      {annotationError && <><p role="alert">{annotationError}</p><button className="secondary-action" type="button" onClick={() => setAnnotationAttempt((attempt) => attempt + 1)}>Retry annotation</button></>}
      <h3>Focus first</h3>
      <ol className="corrections">
        {result.topCorrections.map((correction) => <li key={correction.observationId}>{correction.text}</li>)}
      </ol>
      <details open>
        <summary>Full-body review</summary>
        <div role="group" aria-label="Full-body review">
          {result.fullBodyReview.map((section) => (
            <section key={section.region}>
              <h3>{regionLabels[section.region]}</h3>
              {section.items.map((item) => <p key={item.observationId}>{item.text}</p>)}
            </section>
          ))}
        </div>
      </details>
      <Disclaimer />
      <button className="primary-action" type="button" onClick={() => void download()} disabled={!image || !annotationReady}>Download result</button>
      {downloadError && <p role="alert">{downloadError}</p>}
      <button className="secondary-action" type="button" onClick={onAnotherPhoto}>Analyse another photo</button>
    </section>
  );
}

import type { BodyRegion } from '../domain/types';
import type { QualityReport } from '../quality/types';

interface CheckCardProps {
  report: QualityReport;
  onRetake: () => void;
  onAnalyse: () => void;
}

const regionLabels: Record<BodyRegion, string> = {
  'supporting-leg': 'Supporting leg',
  'working-leg': 'Working leg',
  pelvis: 'Pelvis',
  torso: 'Torso',
  'shoulders-arms': 'Shoulders and arms',
  head: 'Head',
  feet: 'Feet',
};

const resizeNotice = 'Large photo resized for analysis. Its proportions were preserved.';
const partialAssessmentNotice = 'Some areas were not assessed because their joint positions were obscured or inconsistent.';

function PassedCheck({ children }: { children: string }) {
  return <li><span aria-hidden="true">✓</span> {children}</li>;
}

export function CheckCard({ report, onRetake, onAnalyse }: CheckCardProps) {
  if (report.status === 'fail') {
    return (
      <section className="check-card" aria-label="Photo check">
        <div role="alert">
          <h2>Photo needs another try</h2>
          <ul>{report.reasons.map((item) => <li key={item.code}>{item.message}</li>)}</ul>
        </div>
        {report.imageWasResized && <p className="status-note">{resizeNotice}</p>}
        <button className="secondary-action" type="button" onClick={onRetake}>Retake photo</button>
      </section>
    );
  }

  return (
    <section className="check-card" aria-label="Photo check">
      <h2>{report.status === 'pass' ? 'Photo check passed' : 'Photo check partially passed'}</h2>
      <ul>
        <PassedCheck>Full body visible</PassedCheck>
        <PassedCheck>Camera view matches the guide</PassedCheck>
        <PassedCheck>Required joints visible</PassedCheck>
      </ul>
      {report.imageWasResized && (
        <p className="status-note">{resizeNotice}</p>
      )}
      {report.status === 'partial' && (
        <>
          <p className="status-note">{partialAssessmentNotice}</p>
          <ul>
            {report.unassessableRegions.map((region) => (
              <li key={region}>{regionLabels[region]} cannot be assessed from this photo.</li>
            ))}
          </ul>
        </>
      )}
      <button className="primary-action" type="button" onClick={onAnalyse}>Analyse position</button>
    </section>
  );
}

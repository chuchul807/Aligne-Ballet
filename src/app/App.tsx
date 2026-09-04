import { useReducer, useState } from 'react';
import type { PoseName, SupportingSide } from '../domain/types';
import { initialSessionState, sessionReducer } from '../session/sessionReducer';
import { StepTabs } from '../ui/StepTabs';

const positionLabels: Record<PoseName, string> = {
  arabesque: 'Arabesque',
  'attitude-derriere': 'Attitude derrière',
  'retire-passe': 'Retiré passé',
};

export function App() {
  const [session, dispatch] = useReducer(sessionReducer, initialSessionState);
  const [position, setPosition] = useState<PoseName>('arabesque');
  const [supportingSide, setSupportingSide] = useState<SupportingSide>('left');

  const confirmSelection = () => {
    dispatch({ type: 'selection-confirmed', position, supportingSide });
  };

  return (
    <div className="app-shell">
      <main className="app-card" aria-label="ALIGNÉ ballet feedback">
        <header className="app-header">
          <p className="eyebrow">ALIGNÉ</p>
          <h1>Practice with a clearer eye</h1>
          <p>One focused check at a time.</p>
        </header>

        <StepTabs
          stage={session.stage}
          unlockedStages={session.unlockedStages}
          onSelect={(stage) => dispatch({ type: 'stage-requested', stage })}
        />

        {session.stage === 'select' && (
          <section className="stage-card" id="select-stage" role="tabpanel" aria-label="Select">
            <p className="stage-kicker">Step 1 of 4</p>
            <h2>Choose your position</h2>
            <label htmlFor="position">Position</label>
            <select
              id="position"
              value={position}
              onChange={(event) => {
                const nextPosition = event.target.value as PoseName;
                setPosition(nextPosition);
                dispatch({ type: 'position-changed', position: nextPosition });
              }}
            >
              {Object.entries(positionLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
            </select>
            <fieldset>
              <legend>Supporting side</legend>
              <div className="choice-row">
                {(['left', 'right'] as const).map((side) => (
                  <button
                    className={supportingSide === side ? 'choice selected' : 'choice'}
                    type="button"
                    key={side}
                    aria-pressed={supportingSide === side}
                    onClick={() => setSupportingSide(side)}
                  >
                    {side === 'left' ? 'Left' : 'Right'}
                    {supportingSide === side && <><span aria-hidden="true"> </span><span className="selected-copy">Selected</span></>}
                  </button>
                ))}
              </div>
            </fieldset>
            <button className="primary-action" type="button" onClick={confirmSelection}>Continue to framing</button>
          </section>
        )}

        {session.stage === 'frame' && (
          <section className="stage-card" id="frame-stage" role="tabpanel" aria-label="Frame">
            <p className="stage-kicker">Step 2 of 4</p>
            <h2>Frame your photo</h2>
            <p>Use a clear, full-body photo from the recommended angle. Photo selection will be available in the next step of this experience.</p>
            <div className="status-note"><span aria-hidden="true">◌</span> Ready when your full body is visible.</div>
            <button className="secondary-action" type="button" onClick={() => dispatch({ type: 'stage-requested', stage: 'select' })}>Edit selection</button>
          </section>
        )}

        {session.stage === 'check' && (
          <section className="stage-card" id="check-stage" role="tabpanel" aria-label="Check">
            <p className="stage-kicker">Step 3 of 4</p>
            <h2>Photo check</h2>
            <p>Your framing check will appear here once a photo is selected.</p>
            <div className="status-note"><span aria-hidden="true">◌</span> Waiting for a photo.</div>
          </section>
        )}

        {session.stage === 'result' && (
          <section className="stage-card" id="result-stage" role="tabpanel" aria-label="Result">
            <p className="stage-kicker">Step 4 of 4</p>
            <h2>Your feedback</h2>
            <p>Your focused corrections will appear here after analysis.</p>
          </section>
        )}
      </main>
    </div>
  );
}

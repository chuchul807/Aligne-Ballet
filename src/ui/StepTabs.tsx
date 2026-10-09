import type { Stage } from '../session/sessionReducer';

interface StepTabsProps {
  stage: Stage;
  unlockedStages: ReadonlySet<Stage>;
  onSelect: (stage: Stage) => void;
}

const steps: readonly { stage: Stage; label: string }[] = [
  { stage: 'select', label: 'Select' },
  { stage: 'frame', label: 'Frame' },
  { stage: 'check', label: 'Check' },
  { stage: 'result', label: 'Result' },
];

export function StepTabs({ stage, unlockedStages, onSelect }: StepTabsProps) {
  return (
    <div className="step-tabs" role="tablist" aria-label="Analysis steps">
      {steps.map((step) => {
        const isUnlocked = unlockedStages.has(step.stage);

        return (
          <button
            className="step-tab"
            type="button"
            role="tab"
            key={step.stage}
            aria-selected={stage === step.stage}
            disabled={!isUnlocked}
            onClick={() => onSelect(step.stage)}
          >
            <span>{step.label}</span>
            {!isUnlocked && <span className="step-lock" aria-hidden="true">⌕</span>}
          </button>
        );
      })}
    </div>
  );
}

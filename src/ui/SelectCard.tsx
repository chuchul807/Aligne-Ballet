import type { PoseName, SupportingSide } from '../domain/types';

interface SelectCardProps {
  position: PoseName;
  supportingSide: SupportingSide;
  onPositionChange: (position: PoseName) => void;
  onSupportingSideChange: (side: SupportingSide) => void;
  onConfirm: () => void;
}

const positions: readonly { value: PoseName; label: string }[] = [
  { value: 'arabesque', label: 'Arabesque' },
  { value: 'attitude-derriere', label: 'Attitude derrière' },
  { value: 'retire-passe', label: 'Retiré / Passé' },
  { value: 'a-la-seconde', label: 'À la seconde (en face)' },
  { value: 'tendu-croise-devant', label: 'Tendu croisé devant (en face)' },
];

export function SelectCard({ position, supportingSide, onPositionChange, onSupportingSideChange, onConfirm }: SelectCardProps) {
  return (
    <section className="stage-card select-card" aria-label="Select position">
      <p className="stage-kicker">Step 1 of 4</p>
      <h2>Choose your position</h2>
      <fieldset>
        <legend>Position</legend>
        <div className="radio-stack">
          {positions.map(({ value, label }) => (
            <label className="radio-choice" key={value}>
              <input type="radio" name="position" value={value} checked={position === value} onChange={() => onPositionChange(value)} />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend>Supporting side</legend>
        <div className="choice-row">
          {(['left', 'right'] as const).map((side) => (
            <label className="radio-choice" key={side}>
              <input type="radio" name="supporting-side" value={side} checked={supportingSide === side} onChange={() => onSupportingSideChange(side)} />
              <span>{side === 'left' ? 'Left' : 'Right'}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <button className="primary-action" type="button" onClick={onConfirm}>Continue to framing</button>
    </section>
  );
}

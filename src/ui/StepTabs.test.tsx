import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { StepTabs } from './StepTabs';

describe('StepTabs', () => {
  it('renders one selected tab and disables locked Result', () => {
    render(<StepTabs stage="frame" unlockedStages={new Set(['select', 'frame'])} onSelect={vi.fn()} />);

    expect(screen.getByRole('tab', { name: 'Frame' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Result' })).toBeDisabled();
  });
});

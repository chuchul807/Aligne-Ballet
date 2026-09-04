import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { App } from './App';

afterEach(cleanup);

describe('App', () => {
  it('locks completed stages when its position dropdown changes', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Continue to framing' }));
    await user.click(screen.getByRole('tab', { name: 'Select' }));
    await user.selectOptions(screen.getByLabelText('Position'), 'retire-passe');

    expect(screen.getByRole('tab', { name: 'Frame' })).toBeDisabled();
    expect(screen.getByRole('tab', { name: 'Result' })).toBeDisabled();
  });

  it('shows selected supporting side with visible text', () => {
    render(<App />);

    expect(screen.getByText('Selected')).toBeVisible();
  });
});

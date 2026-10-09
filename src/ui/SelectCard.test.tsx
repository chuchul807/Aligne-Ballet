import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SelectCard } from './SelectCard';

afterEach(cleanup);

describe('SelectCard', () => {
  it('uses native radio groups for all supported positions and supporting sides', async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    render(<SelectCard position="arabesque" supportingSide="left" onPositionChange={vi.fn()} onSupportingSideChange={vi.fn()} onConfirm={onConfirm} />);

    expect(screen.getByRole('radio', { name: 'Arabesque' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Attitude derrière' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Retiré / Passé' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'À la seconde (en face)' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Tendu croisé devant (en face)' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Left' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Right' })).toBeInTheDocument();
    expect(screen.queryByText("Choose the dancer's body side, not the side of the photo.")).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Continue to framing' }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });
});

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { landmarkPerson } from '../../tests/builders/landmarks';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('App', () => {
  it('uses the selection card radios and keeps only its active card mounted', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.getByRole('radio', { name: 'Arabesque' })).toBeChecked();
    expect(screen.queryByLabelText('Photo framing')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Continue to framing' }));

    expect(screen.getByLabelText('Photo framing')).toBeInTheDocument();
    expect(screen.queryByLabelText('Select position')).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Result' })).toBeDisabled();
  });

  it('creates a detector only after an accepted image file is selected', async () => {
    const createDetector = vi.fn().mockResolvedValue({ detect: vi.fn(), close: vi.fn() });
    const user = userEvent.setup({ applyAccept: false });
    render(<App services={{ createDetector, now: () => '2026-09-03T12:00:00.000Z' }} />);

    expect(createDetector).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Continue to framing' }));
    await user.upload(screen.getByLabelText('Choose a photo'), new File(['photo'], 'pose.jpg', { type: 'image/jpeg' }));
    expect(createDetector).toHaveBeenCalledOnce();
  });

  it('moves a fake-detector analysis through check before mounting the result card', async () => {
    const user = userEvent.setup({ applyAccept: false });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const source = document.createElement('canvas'); source.width = 1000; source.height = 1500;
    render(<App services={{
      createDetector: vi.fn().mockResolvedValue({ detect: vi.fn().mockResolvedValue({ people: [landmarkPerson()], sourceWidth: 1000, sourceHeight: 1500 }), close: vi.fn() }),
      now: () => '2026-09-03T12:00:00.000Z',
      analysis: {
        decode: vi.fn().mockResolvedValue({ source, width: 1000, height: 1500, dispose: vi.fn() }),
        metrics: vi.fn(() => ({ meanLuminance: 0.5, contrast: 0.2, edgeEnergy: 0.1 })),
        quality: vi.fn(() => ({ status: 'pass' as const, reasons: [], unassessableRegions: [] })),
      },
    }} />);

    await user.click(screen.getByRole('button', { name: 'Continue to framing' }));
    await user.upload(screen.getByLabelText('Choose a photo'), new File(['photo'], 'pose.jpg', { type: 'image/jpeg' }));
    expect(await screen.findByRole('button', { name: 'Analyse position' })).toBeEnabled();
    expect(screen.queryByLabelText('Your feedback')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Analyse position' }));
    expect(screen.getByLabelText('Your feedback')).toBeInTheDocument();
    expect(screen.queryByLabelText('Photo check')).not.toBeInTheDocument();
  });
});

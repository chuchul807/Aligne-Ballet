import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AnalysisResult } from '../domain/types';
import { drawAnnotatedPose } from '../annotation/drawAnnotatedPose';
import { ResultCard } from './ResultCard';

vi.mock('../annotation/drawAnnotatedPose', () => ({ drawAnnotatedPose: vi.fn() }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const result: AnalysisResult = {
  sessionId: 'session', position: 'arabesque', landmarks: [], annotations: [], createdAt: '2026-09-03T12:00:00.000Z',
  topCorrections: [
    { observationId: 'one', text: 'Straighten the supporting knee.', region: 'supporting-leg', priority: 'stability', confidence: 'high' },
    { observationId: 'two', text: 'Level the pelvis.', region: 'pelvis', priority: 'structure', confidence: 'high' },
  ],
  fullBodyReview: [{ region: 'torso', status: 'clear', items: [{ observationId: 'clear', text: 'No visible issue found in this view.', region: 'torso', priority: 'line', confidence: 'high' }] }],
};

describe('ResultCard', () => {
  it('shows only available numbered corrections, full review, disclaimer, and reset action', () => {
    render(<ResultCard result={result} image={null} onAnotherPhoto={vi.fn()} />);

    const corrections = screen.getAllByRole('listitem');
    expect(corrections[0]).toHaveTextContent('Straighten the supporting knee.');
    expect(corrections[0]).not.toHaveTextContent('1.');
    expect(corrections[1]).toHaveTextContent('Level the pelvis.');
    expect(screen.getByRole('group', { name: 'Full-body review' })).toBeInTheDocument();
    expect(screen.getByText(/does not replace guidance from a qualified ballet teacher/i)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Analyse another photo' })).toBeEnabled();
  });

  it('does not present an annotated image or download when annotation fails, then retries successfully', async () => {
    const user = userEvent.setup();
    const draw = vi.mocked(drawAnnotatedPose);
    draw.mockImplementationOnce(() => { throw new Error('canvas failed'); });
    const image = document.createElement('canvas'); image.width = 1000; image.height = 1500;
    render(<ResultCard result={result} image={image} onAnotherPhoto={vi.fn()} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Annotated image could not be prepared. Please try again.');
    expect(screen.queryByRole('img', { name: /Annotated Arabesque/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download result' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Retry annotation' }));
    expect(await screen.findByRole('img', { name: /Annotated Arabesque/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download result' })).toBeEnabled();
  });
});

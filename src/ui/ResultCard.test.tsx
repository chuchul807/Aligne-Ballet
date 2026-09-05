import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AnalysisResult } from '../domain/types';
import { ResultCard } from './ResultCard';

afterEach(cleanup);

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

    expect(screen.getByText('1. Straighten the supporting knee.')).toBeVisible();
    expect(screen.getByText('2. Level the pelvis.')).toBeVisible();
    expect(screen.queryByText(/^3\./)).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Full-body review' })).toBeInTheDocument();
    expect(screen.getByText(/does not replace guidance from a qualified ballet teacher/i)).toBeVisible();
    expect(screen.getByRole('button', { name: 'Analyse another photo' })).toBeEnabled();
  });
});

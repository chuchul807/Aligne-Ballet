import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { QualityReport } from '../quality/types';
import { CheckCard } from './CheckCard';

afterEach(cleanup);

const failedReport: QualityReport = {
  status: 'fail',
  reasons: [
    { code: 'no-person', message: 'No full body was detected. Step back and try again.' },
    { code: 'too-dark', message: 'Use brighter, even lighting and try again.' },
  ],
  unassessableRegions: [],
};

describe('CheckCard', () => {
  it('shows the resize notice without adding another step', () => {
    render(<CheckCard report={{ status: 'pass', reasons: [], unassessableRegions: [], imageWasResized: true }} onRetake={vi.fn()} onAnalyse={vi.fn()} />);

    expect(screen.getByText('Large photo resized for analysis. Its proportions were preserved.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Analyse position' })).toBeEnabled();
  });

  it('lists every retake reason in an alert and never offers analysis for a failed check', async () => {
    const onRetake = vi.fn();
    const user = userEvent.setup();
    render(<CheckCard report={failedReport} onRetake={onRetake} onAnalyse={vi.fn()} />);

    expect(screen.getByRole('alert')).toHaveTextContent('No full body was detected. Step back and try again.');
    expect(screen.getByRole('alert')).toHaveTextContent('Use brighter, even lighting and try again.');
    expect(screen.queryByRole('button', { name: 'Analyse position' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Retake photo' }));
    expect(onRetake).toHaveBeenCalledOnce();
  });

  it('shows the preserved resize notice on a failed post-analysis check', () => {
    render(<CheckCard
      report={{ ...failedReport, imageWasResized: true }}
      onRetake={vi.fn()}
      onAnalyse={vi.fn()}
    />);

    expect(screen.getByText('Large photo resized for analysis. Its proportions were preserved.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Retake photo' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: 'Analyse position' })).not.toBeInTheDocument();
  });

  it('describes all passed checks with text and icons before offering analysis', () => {
    const report: QualityReport = { status: 'pass', reasons: [], unassessableRegions: [] };
    render(<CheckCard report={report} onRetake={vi.fn()} onAnalyse={vi.fn()} />);

    expect(screen.getByText('Full body visible')).toBeVisible();
    expect(screen.getByText('Camera view matches the guide')).toBeVisible();
    expect(screen.getByText('Required joints visible')).toBeVisible();
    expect(screen.getAllByText('✓')).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'Analyse position' })).toBeEnabled();
  });

  it('keeps analysis available and identifies optional unassessable regions for a partial check', () => {
    const report: QualityReport = {
      status: 'partial', reasons: [], unassessableRegions: ['shoulders-arms'],
    };
    render(<CheckCard report={report} onRetake={vi.fn()} onAnalyse={vi.fn()} />);

    const note = screen.getByText('Some areas were not assessed because their joint positions were obscured or inconsistent.');
    const regionalItem = screen.getByText('Shoulders and arms cannot be assessed from this photo.');
    expect(screen.getAllByText('Some areas were not assessed because their joint positions were obscured or inconsistent.')).toHaveLength(1);
    expect(note.compareDocumentPosition(regionalItem) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByText('Shoulders and arms cannot be assessed from this photo.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Analyse position' })).toBeEnabled();
  });
});

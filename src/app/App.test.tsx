import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { landmarkPerson } from '../../tests/builders/landmarks';
import type { LandmarkSet } from '../domain/types';
import type { DecodedImage } from '../image/decodeImage';
import type { RefinePoseInput, RefinedPoseOutcome } from '../pose/refinePoseDetection';
import * as annotation from '../annotation/drawAnnotatedPose';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => { resolve = next; });
  return { promise, resolve };
}

function decodedImage(source: HTMLCanvasElement, dispose = vi.fn(), wasResized = false): DecodedImage {
  return {
    source,
    width: source.width,
    height: source.height,
    normalisation: { wasResized, originalWidth: wasResized ? 8000 : source.width, originalHeight: wasResized ? 4000 : source.height },
    dispose,
  };
}

async function stableRefine({ whole }: RefinePoseInput): Promise<RefinedPoseOutcome> {
  return { status: 'success', landmarks: whole, disagreements: new Set() };
}

function validLandmarks(): LandmarkSet {
  return { people: [landmarkPerson()], sourceWidth: 1000, sourceHeight: 1500 };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.history.replaceState({}, '', '/');
});

describe('App', () => {
  it('shows in-memory analysis diagnostics only when debug mode is requested', async () => {
    window.history.replaceState({}, '', '/?debug=1');
    const user = userEvent.setup({ applyAccept: false });
    const landmarks = landmarkPerson().map((point) => (
      point.name === 'left_shoulder'
      || point.name === 'right_shoulder'
      || point.name === 'left_hip'
      || point.name === 'right_hip'
        ? { ...point, x: 0.5 }
        : point
    ));
    const source = document.createElement('canvas');
    source.width = 1000;
    source.height = 1500;
    render(<App services={{
      createDetector: vi.fn().mockResolvedValue({
        detect: vi.fn().mockResolvedValue({ people: [landmarks], sourceWidth: 1000, sourceHeight: 1500 }),
        close: vi.fn(),
      }),
      now: () => '2026-09-03T12:00:00.000Z',
      analysis: {
        decode: vi.fn().mockResolvedValue(decodedImage(source)),
        metrics: vi.fn(() => ({ meanLuminance: 0.5, contrast: 0.2, edgeEnergy: 0.1 })),
      },
    }} />);

    await user.click(screen.getByRole('button', { name: 'Continue to framing' }));
    await user.upload(screen.getByLabelText('Choose a photo'), new File(['photo'], 'pose.jpg', { type: 'image/jpeg' }));

    const diagnostics = await screen.findByLabelText('Analysis diagnostics');
    expect((diagnostics as HTMLTextAreaElement).value).toContain('"cameraViewRatio": 0');
    expect((diagnostics as HTMLTextAreaElement).value).toContain('"userAgent"');
    expect((diagnostics as HTMLTextAreaElement).value).toContain('"createImageBitmap"');
  });

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

  it.each(['À la seconde (en face)', 'Tendu croisé devant (en face)'])(
    'uses the front-view photo guide for %s',
    async (positionLabel) => {
      const user = userEvent.setup();
      render(<App />);

      await user.click(screen.getByRole('radio', { name: positionLabel }));
      await user.click(screen.getByRole('button', { name: 'Continue to framing' }));

      expect(screen.getByRole('heading', { name: 'Front view guide' })).toBeVisible();
      expect(screen.getByText(/Face the camera/)).toBeVisible();
    },
  );

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
        decode: vi.fn().mockResolvedValue(decodedImage(source)),
        metrics: vi.fn(() => ({ meanLuminance: 0.5, contrast: 0.2, edgeEnergy: 0.1 })),
        quality: vi.fn(() => ({ status: 'pass' as const, reasons: [], unassessableRegions: [] })),
        refine: stableRefine,
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

  it('keeps the normalised source through Result and releases it on reset', async () => {
    const user = userEvent.setup({ applyAccept: false });
    const source = document.createElement('canvas'); source.width = 4096; source.height = 2048;
    const dispose = vi.fn();
    const draw = vi.spyOn(annotation, 'drawAnnotatedPose').mockImplementation((canvas) => canvas);
    render(<App services={{
      createDetector: vi.fn().mockResolvedValue({ detect: vi.fn().mockResolvedValue({ people: [landmarkPerson()], sourceWidth: 4096, sourceHeight: 2048 }), close: vi.fn() }),
      now: () => '2026-09-03T12:00:00.000Z',
      analysis: {
        decode: vi.fn().mockResolvedValue(decodedImage(source, dispose, true)),
        metrics: vi.fn(() => ({ meanLuminance: 0.5, contrast: 0.2, edgeEnergy: 0.1 })),
        quality: vi.fn(() => ({ status: 'pass' as const, reasons: [], unassessableRegions: [] })),
        refine: stableRefine,
      },
    }} />);

    await user.click(screen.getByRole('button', { name: 'Continue to framing' }));
    await user.upload(screen.getByLabelText('Choose a photo'), new File(['photo'], 'pose.jpg', { type: 'image/jpeg' }));
    expect(await screen.findByText('Large photo resized for analysis. Its proportions were preserved.')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Analyse position' }));
    await waitFor(() => expect(draw).toHaveBeenCalledWith(expect.any(HTMLCanvasElement), source, expect.anything(), expect.anything()));

    await user.click(screen.getByRole('button', { name: 'Analyse another photo' }));
    expect(dispose).toHaveBeenCalledOnce();
  });

  it('invalidates and releases a stale Result when the supporting side changes', async () => {
    const user = userEvent.setup({ applyAccept: false });
    const source = document.createElement('canvas'); source.width = 1000; source.height = 1500;
    const dispose = vi.fn();
    vi.spyOn(annotation, 'drawAnnotatedPose').mockImplementation((canvas) => canvas);
    render(<App services={{
      createDetector: vi.fn().mockResolvedValue({ detect: vi.fn().mockResolvedValue({ people: [landmarkPerson()], sourceWidth: 1000, sourceHeight: 1500 }), close: vi.fn() }),
      now: () => '2026-09-03T12:00:00.000Z',
      analysis: {
        decode: vi.fn().mockResolvedValue(decodedImage(source, dispose)),
        metrics: vi.fn(() => ({ meanLuminance: 0.5, contrast: 0.2, edgeEnergy: 0.1 })),
        quality: vi.fn(() => ({ status: 'pass' as const, reasons: [], unassessableRegions: [] })),
        refine: stableRefine,
      },
    }} />);

    await user.click(screen.getByRole('button', { name: 'Continue to framing' }));
    await user.upload(screen.getByLabelText('Choose a photo'), new File(['photo'], 'pose.jpg', { type: 'image/jpeg' }));
    await user.click(await screen.findByRole('button', { name: 'Analyse position' }));
    await user.click(screen.getByRole('tab', { name: 'Select' }));
    await user.click(screen.getByRole('radio', { name: 'Right' }));

    expect(screen.getByRole('tab', { name: 'Result' })).toBeDisabled();
    expect(dispose).toHaveBeenCalledOnce();
    expect(screen.queryByLabelText('Your feedback')).not.toBeInTheDocument();
  });

  it('shows an actionable Retake photo control for decoded dimension failures instead of the generic error', async () => {
    const user = userEvent.setup({ applyAccept: false });
    render(<App services={{
      createDetector: vi.fn().mockResolvedValue({ detect: vi.fn(), close: vi.fn() }), now: () => '2026-09-03T12:00:00.000Z',
      analysis: { decode: vi.fn().mockRejectedValue({ code: 'image-too-small' }) },
    }} />);

    await user.click(screen.getByRole('button', { name: 'Continue to framing' }));
    await user.upload(screen.getByLabelText('Choose a photo'), new File(['photo'], 'pose.jpg', { type: 'image/jpeg' }));

    expect(await screen.findByRole('button', { name: 'Retake photo' })).toBeEnabled();
    expect(screen.getByRole('alert')).toHaveTextContent('shortest side of at least 480 pixels');
    expect(screen.queryByText('Analysis could not be completed. Please try again.')).toBeNull();
  });

  it('ignores and disposes a stale analysis when refinement resolves after the position changes', async () => {
    const user = userEvent.setup({ applyAccept: false });
    const refinement = deferred<RefinedPoseOutcome>();
    const refine = vi.fn(() => refinement.promise);
    const dispose = vi.fn();
    render(<App services={{
      createDetector: vi.fn().mockResolvedValue({ detect: vi.fn().mockResolvedValue(validLandmarks()), close: vi.fn() }), now: () => '2026-09-03T12:00:00.000Z',
      analysis: { decode: vi.fn().mockResolvedValue(decodedImage(Object.assign(document.createElement('canvas'), { width: 1000, height: 1500 }), dispose, true)), metrics: vi.fn(() => ({ meanLuminance: .5, contrast: .2, edgeEnergy: .1 })), quality: vi.fn(() => ({ status: 'pass' as const, reasons: [], unassessableRegions: [] })), refine },
    }} />);

    await user.click(screen.getByRole('button', { name: 'Continue to framing' }));
    await user.upload(screen.getByLabelText('Choose a photo'), new File(['photo'], 'pose.jpg', { type: 'image/jpeg' }));
    await waitFor(() => expect(refine).toHaveBeenCalledOnce());
    await user.click(screen.getByRole('tab', { name: 'Select' }));
    await user.click(screen.getByRole('radio', { name: 'Retiré / Passé' }));
    refinement.resolve({ status: 'success', landmarks: validLandmarks(), disagreements: new Set() });

    expect(await screen.findByRole('button', { name: 'Continue to framing' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Analyse position' })).not.toBeInTheDocument();
    await waitFor(() => expect(dispose).toHaveBeenCalledOnce());
  });

  it('disposes a successful decoded image when unmounted while detection is pending', async () => {
    const user = userEvent.setup({ applyAccept: false });
    const detection = deferred<LandmarkSet>();
    const dispose = vi.fn();
    const rendered = render(<App services={{
      createDetector: vi.fn().mockResolvedValue({ detect: vi.fn(() => detection.promise), close: vi.fn() }), now: () => '2026-09-03T12:00:00.000Z',
      analysis: { decode: vi.fn().mockResolvedValue(decodedImage(Object.assign(document.createElement('canvas'), { width: 1000, height: 1500 }), dispose)), metrics: vi.fn(() => ({ meanLuminance: .5, contrast: .2, edgeEnergy: .1 })), quality: vi.fn(() => ({ status: 'pass' as const, reasons: [], unassessableRegions: [] })), refine: stableRefine },
    }} />);

    await user.click(screen.getByRole('button', { name: 'Continue to framing' }));
    await user.upload(screen.getByLabelText('Choose a photo'), new File(['photo'], 'pose.jpg', { type: 'image/jpeg' }));
    rendered.unmount();
    detection.resolve({ people: [landmarkPerson()], sourceWidth: 1000, sourceHeight: 1500 });
    await waitFor(() => expect(dispose).toHaveBeenCalledOnce());
  });

  it('keeps the active Check tab analysis alive and completes its result path', async () => {
    const user = userEvent.setup({ applyAccept: false });
    const detection = deferred<LandmarkSet>();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    render(<App services={{
      createDetector: vi.fn().mockResolvedValue({ detect: vi.fn(() => detection.promise), close: vi.fn() }), now: () => '2026-09-03T12:00:00.000Z',
      analysis: { decode: vi.fn().mockResolvedValue(decodedImage(Object.assign(document.createElement('canvas'), { width: 1000, height: 1500 }))), metrics: vi.fn(() => ({ meanLuminance: .5, contrast: .2, edgeEnergy: .1 })), quality: vi.fn(() => ({ status: 'pass' as const, reasons: [], unassessableRegions: [] })), refine: stableRefine },
    }} />);

    await user.click(screen.getByRole('button', { name: 'Continue to framing' }));
    await user.upload(screen.getByLabelText('Choose a photo'), new File(['photo'], 'pose.jpg', { type: 'image/jpeg' }));
    expect(screen.getByRole('status')).toHaveTextContent('Checking your photo');
    await user.click(screen.getByRole('tab', { name: 'Check' }));
    detection.resolve({ people: [landmarkPerson()], sourceWidth: 1000, sourceHeight: 1500 });
    await user.click(await screen.findByRole('button', { name: 'Analyse position' }));
    expect(screen.getByLabelText('Your feedback')).toBeInTheDocument();
  });

  it('clears cancelled progress after leaving Check and protects a replacement analysis from the old finally', async () => {
    const user = userEvent.setup({ applyAccept: false });
    const firstDetection = deferred<LandmarkSet>();
    const secondDetection = deferred<LandmarkSet>();
    const detect = vi.fn().mockImplementationOnce(() => firstDetection.promise).mockImplementationOnce(() => secondDetection.promise);
    const firstDispose = vi.fn();
    const secondDispose = vi.fn();
    render(<App services={{
      createDetector: vi.fn().mockResolvedValue({ detect, close: vi.fn() }), now: () => '2026-09-03T12:00:00.000Z',
      analysis: { decode: vi.fn().mockResolvedValueOnce(decodedImage(Object.assign(document.createElement('canvas'), { width: 1000, height: 1500 }), firstDispose)).mockResolvedValueOnce(decodedImage(Object.assign(document.createElement('canvas'), { width: 1000, height: 1500 }), secondDispose)), metrics: vi.fn(() => ({ meanLuminance: .5, contrast: .2, edgeEnergy: .1 })), quality: vi.fn(() => ({ status: 'pass' as const, reasons: [], unassessableRegions: [] })), refine: stableRefine },
    }} />);

    await user.click(screen.getByRole('button', { name: 'Continue to framing' }));
    await user.upload(screen.getByLabelText('Choose a photo'), new File(['photo'], 'pose.jpg', { type: 'image/jpeg' }));
    await user.click(screen.getByRole('tab', { name: 'Frame' }));
    expect(screen.getByLabelText('Photo framing')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Check' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByRole('status')).toBeInTheDocument();
    firstDetection.resolve({ people: [landmarkPerson()], sourceWidth: 1000, sourceHeight: 1500 });
    await waitFor(() => expect(firstDispose).toHaveBeenCalledOnce());
    expect(screen.getByRole('status')).toBeInTheDocument();
    secondDetection.resolve({ people: [landmarkPerson()], sourceWidth: 1000, sourceHeight: 1500 });
    expect(await screen.findByRole('button', { name: 'Analyse position' })).toBeEnabled();
  });
});

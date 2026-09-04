import { describe, expect, it, vi } from 'vitest';
import type { AnalysisResult } from '../domain/types';
import { PRACTICE_DISCLAIMER, renderDownload } from './renderDownload';

class RecordingContext {
  readonly text: string[] = [];
  readonly measureFonts: string[] = [];
  fillStyle = '';
  font = '';
  textBaseline: CanvasTextBaseline = 'alphabetic';
  drawImage() { /* recording is not needed for this contract */ }
  fillRect() { /* recording is not needed for this contract */ }
  fillText(text: string) { this.text.push(text); }
  measureText(text: string) { this.measureFonts.push(this.font); return { width: text.length * 12 } as TextMetrics; }
}

function result(): AnalysisResult {
  return {
    sessionId: 'session-1',
    position: 'arabesque',
    landmarks: [],
    annotations: [],
    fullBodyReview: [],
    createdAt: '2026-09-03T12:00:00.000Z',
    topCorrections: [{ observationId: 'one', text: 'Lengthen your working leg back and slightly upward without changing your pelvis.', region: 'working-leg', priority: 'line', confidence: 'high' }],
  };
}

function canvasFor(context: RecordingContext): HTMLCanvasElement {
  return { width: 0, height: 0, getContext: () => context, toBlob: (callback: BlobCallback) => callback(new Blob(['png'], { type: 'image/png' })) } as unknown as HTMLCanvasElement;
}

describe('renderDownload', () => {
  it('writes the position, numbered correction, exact disclaimer, and a wrapped date into one PNG', async () => {
    const context = new RecordingContext();
    const blob = new Blob(['png'], { type: 'image/png' });
    const canvas = { width: 0, height: 0, getContext: () => context, toBlob: (callback: BlobCallback) => callback(blob) } as unknown as HTMLCanvasElement;
    const createElement = vi.spyOn(document, 'createElement').mockReturnValue(canvas);

    await expect(renderDownload({ image: { width: 400, height: 200 } as unknown as CanvasImageSource, result: result(), generatedAt: new Date('2026-09-04T12:00:00.000Z') })).resolves.toBe(blob);

    expect(context.text).toContain('Arabesque');
    expect(context.text).toContain('1. Lengthen your working leg');
    expect(context.text.join(' ')).toContain(PRACTICE_DISCLAIMER);
    expect(context.text).toContain('Generated 4 September 2026');
    expect(context.measureFonts.every((font) => font !== '')).toBe(true);
    expect(canvas.height).toBeGreaterThan(200);
    createElement.mockRestore();
  });

  it('rejects when the browser cannot produce a PNG blob', async () => {
    const canvas = { width: 0, height: 0, getContext: () => new RecordingContext(), toBlob: (callback: BlobCallback) => callback(null) } as unknown as HTMLCanvasElement;
    const createElement = vi.spyOn(document, 'createElement').mockReturnValue(canvas);

    await expect(renderDownload({ image: { width: 100, height: 100 } as unknown as CanvasImageSource, result: result(), generatedAt: new Date('2026-09-04T12:00:00.000Z') })).rejects.toThrow('Unable to create downloadable PNG.');

    createElement.mockRestore();
  });

  it('caps its own rendered correction list at three items before wrapping and sizing the text area', async () => {
    const threeContext = new RecordingContext();
    const fourContext = new RecordingContext();
    const threeCanvas = canvasFor(threeContext);
    const fourCanvas = canvasFor(fourContext);
    const createElement = vi.spyOn(document, 'createElement').mockReturnValueOnce(threeCanvas).mockReturnValueOnce(fourCanvas);
    const corrections = ['First correction.', 'Second correction.', 'Third correction.', 'Fourth correction must never be rendered.'].map((text, index) => ({
      observationId: String(index + 1), text, region: 'working-leg' as const, priority: 'line' as const, confidence: 'high' as const,
    }));
    const image = { width: 1000, height: 200 } as unknown as CanvasImageSource;

    await renderDownload({ image, result: { ...result(), topCorrections: corrections.slice(0, 3) }, generatedAt: new Date('2026-09-04T12:00:00.000Z') });
    await renderDownload({ image, result: { ...result(), topCorrections: corrections }, generatedAt: new Date('2026-09-04T12:00:00.000Z') });

    expect(fourContext.text).toEqual(expect.arrayContaining(['1. First correction.', '2. Second correction.', '3. Third correction.']));
    expect(fourContext.text.join(' ')).not.toContain('Fourth correction must never be rendered.');
    expect(fourContext.text).not.toContain('4. Fourth correction must never be rendered.');
    expect(fourCanvas.height).toBe(threeCanvas.height);
    createElement.mockRestore();
  });
});

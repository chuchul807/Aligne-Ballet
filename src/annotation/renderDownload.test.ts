import { describe, expect, it, vi } from 'vitest';
import type { AnalysisResult } from '../domain/types';
import { PRACTICE_DISCLAIMER, renderDownload } from './renderDownload';

class RecordingContext {
  readonly text: string[] = [];
  readonly textDraws: Array<{ text: string; x: number; y: number; fillStyle: string; font: string }> = [];
  readonly imageDraws: unknown[][] = [];
  readonly fills: Array<{ x: number; y: number; width: number; height: number; fillStyle: string }> = [];
  readonly roundedRects: Array<[number, number, number, number, number]> = [];
  readonly measureFonts: string[] = [];
  fillStyle = '';
  font = '';
  textBaseline: CanvasTextBaseline = 'alphabetic';
  beginPath() { /* recording is not needed for this contract */ }
  roundRect(x: number, y: number, width: number, height: number, radius: number) { this.roundedRects.push([x, y, width, height, radius]); }
  clip() { /* recording is not needed for this contract */ }
  save() { /* recording is not needed for this contract */ }
  restore() { /* recording is not needed for this contract */ }
  drawImage(...args: unknown[]) { this.imageDraws.push(args); }
  fillRect(x: number, y: number, width: number, height: number) { this.fills.push({ x, y, width, height, fillStyle: this.fillStyle }); }
  fillText(text: string, x: number, y: number) {
    this.text.push(text);
    this.textDraws.push({ text, x, y, fillStyle: this.fillStyle, font: this.font });
  }
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
    topCorrections: [{ observationId: 'one', ruleId: 'arabesque-working-leg-too-low', direction: 'lift-working-leg', text: 'Lengthen your working leg back and slightly upward without changing your pelvis.', region: 'working-leg', priority: 'line', confidence: 'high' }],
  };
}

function canvasFor(context: RecordingContext): HTMLCanvasElement {
  return { width: 0, height: 0, getContext: () => context, toBlob: (callback: BlobCallback) => callback(new Blob(['png'], { type: 'image/png' })) } as unknown as HTMLCanvasElement;
}

describe('renderDownload', () => {
  it('lays out the approved phone-friendly hierarchy using the website visual system', async () => {
    const context = new RecordingContext();
    const canvas = canvasFor(context);
    const createElement = vi.spyOn(document, 'createElement').mockReturnValue(canvas);
    const image = { width: 912, height: 945 } as unknown as CanvasImageSource;

    await renderDownload({ image, result: result(), generatedAt: new Date('2026-10-04T12:00:00.000Z') });

    expect(canvas).toMatchObject({ width: 912, height: 1543 });
    expect(context.text.slice(0, 3)).toEqual(['October 4th 2026', 'Arabesque', 'Your Feedback:']);
    expect(context.text.join(' ')).not.toContain('Generated');
    expect(context.textDraws.find(({ text }) => text === 'October 4th 2026')).toMatchObject({ fillStyle: '#653246', font: expect.stringMatching(/^700 .*Georgia/) });
    expect(context.textDraws.find(({ text }) => text === 'Arabesque')).toMatchObject({ y: 1007, fillStyle: '#653246', font: expect.stringMatching(/^700 .*Georgia/) });
    expect(context.textDraws.find(({ text }) => text === 'Your Feedback:')).toMatchObject({ y: 1076, fillStyle: '#653246' });
    expect(context.textDraws.find(({ text }) => text.startsWith('1. Lengthen'))).toMatchObject({ y: 1161, fillStyle: '#3f2831' });
    expect(context.fills[0]).toEqual({ x: 0, y: 0, width: 912, height: 1543, fillStyle: '#f7dce1' });
    expect(context.imageDraws[0]?.slice(1)).toEqual([50, 126, 812, 841]);
    expect(context.roundedRects).toContainEqual([50, 126, 812, 841, 18]);
    const disclaimerDraw = context.textDraws.find(({ text }) => text.startsWith('This feedback supports practice'));
    expect(disclaimerDraw?.y).toBeGreaterThan(1388);
    expect(disclaimerDraw?.fillStyle).toBe('#75515f');
    createElement.mockRestore();
  });

  it('uses the viewer local calendar date rather than advancing at UTC midnight', async () => {
    const context = new RecordingContext();
    const canvas = canvasFor(context);
    const createElement = vi.spyOn(document, 'createElement').mockReturnValue(canvas);
    const localLateEvening = new Date(2026, 9, 5, 23, 30);

    await renderDownload({ image: { width: 400, height: 200 } as unknown as CanvasImageSource, result: result(), generatedAt: localLateEvening });

    expect(context.text).toContain('October 5th 2026');
    expect(context.text).not.toContain('October 6th 2026');
    createElement.mockRestore();
  });

  it.each([
    ['a-la-seconde', 'À la seconde (en face)'],
    ['tendu-croise-devant', 'Tendu croisé devant (en face)'],
  ] as const)('writes the %s position label into the PNG', async (position, label) => {
    const context = new RecordingContext();
    const canvas = canvasFor(context);
    const createElement = vi.spyOn(document, 'createElement').mockReturnValue(canvas);

    await renderDownload({
      image: { width: 400, height: 200 } as unknown as CanvasImageSource,
      result: { ...result(), position },
      generatedAt: new Date('2026-09-04T12:00:00.000Z'),
    });

    expect(context.text).toContain(label);
    createElement.mockRestore();
  });

  it('writes the position, feedback heading, numbered correction, exact disclaimer, and date into one PNG', async () => {
    const context = new RecordingContext();
    const blob = new Blob(['png'], { type: 'image/png' });
    const canvas = { width: 0, height: 0, getContext: () => context, toBlob: (callback: BlobCallback) => callback(blob) } as unknown as HTMLCanvasElement;
    const createElement = vi.spyOn(document, 'createElement').mockReturnValue(canvas);

    await expect(renderDownload({ image: { width: 400, height: 200 } as unknown as CanvasImageSource, result: result(), generatedAt: new Date('2026-09-04T12:00:00.000Z') })).resolves.toBe(blob);

    expect(context.text).toContain('Arabesque');
    expect(context.text).toContain('Your Feedback:');
    expect(context.text).toContain('1. Lengthen your working leg');
    expect(context.text.join(' ')).toContain(PRACTICE_DISCLAIMER);
    expect(context.text).toContain('September 4th 2026');
    expect(context.text.join(' ')).not.toContain('Generated');
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
      observationId: String(index + 1), ruleId: 'arabesque-working-leg-too-low', direction: 'lift-working-leg', text, region: 'working-leg' as const, priority: 'line' as const, confidence: 'high' as const,
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

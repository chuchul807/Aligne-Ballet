import { describe, expect, it } from 'vitest';
import type { DrawingCommand, Landmark } from '../domain/types';
import { drawAnnotatedPose } from './drawAnnotatedPose';

class RecordingContext {
  readonly calls: Array<{ name: string; values: number[] | string }> = [];
  lineWidth = 0;
  strokeStyle = '';
  fillStyle = '';
  font = '';
  textAlign: CanvasTextAlign = 'start';
  textBaseline: CanvasTextBaseline = 'alphabetic';
  globalAlpha = 1;
  drawImage(...values: number[]) { this.calls.push({ name: 'drawImage', values }); }
  beginPath() { this.calls.push({ name: 'beginPath', values: [] }); }
  moveTo(...values: number[]) { this.calls.push({ name: 'moveTo', values }); }
  lineTo(...values: number[]) { this.calls.push({ name: 'lineTo', values }); }
  arc(...values: number[]) { this.calls.push({ name: 'arc', values }); }
  stroke() { this.calls.push({ name: 'stroke', values: [] }); }
  fill() { this.calls.push({ name: 'fill', values: [] }); }
  fillText(text: string, ...values: number[]) { this.calls.push({ name: 'fillText', values: text }); }
}

describe('drawAnnotatedPose', () => {
  it('draws neutral structural dots before the numbered correction marker', () => {
    const context = new RecordingContext();
    const canvas = { width: 0, height: 0, getContext: () => context } as unknown as HTMLCanvasElement;
    const landmarks: readonly Landmark[] = [{ name: 'left_knee', x: 0.25, y: 0.5, visibility: 1 }];
    const commands = [
      { type: 'structural-joint', joint: 'left_knee' },
      { type: 'highlight-joint', observationId: 'knee', joint: 'left_knee', label: 1 },
    ] as unknown as readonly DrawingCommand[];

    drawAnnotatedPose(canvas, { width: 8000, height: 4000 } as unknown as CanvasImageSource, landmarks, commands);

    const arcs = context.calls.filter((call) => call.name === 'arc');
    expect(arcs).toHaveLength(2);
    expect(arcs[0]).toEqual({ name: 'arc', values: [1024, 1024, 2048 / 220, 0, Math.PI * 2] });
    expect(arcs[1]).toEqual({ name: 'arc', values: [1024, 1024, 32, 0, Math.PI * 2] });
  });

  it('caps source dimensions, maps normalised landmarks, and draws arrowheads without mutating landmarks', () => {
    const context = new RecordingContext();
    const canvas = { width: 0, height: 0, getContext: () => context } as unknown as HTMLCanvasElement;
    const landmarks: readonly Landmark[] = [{ name: 'left_knee', x: 0.25, y: 0.5, visibility: 1 }];
    const commands: readonly DrawingCommand[] = [
      { type: 'highlight-joint', observationId: 'knee', joint: 'left_knee', label: 1 },
      { type: 'direction-arrow', observationId: 'knee', anchor: 'left_knee', dx: 0.1, dy: -0.1, label: 1 },
    ];
    const before = JSON.stringify(landmarks);

    drawAnnotatedPose(canvas, { width: 8000, height: 4000 } as unknown as CanvasImageSource, landmarks, commands);

    expect([canvas.width, canvas.height]).toEqual([4096, 2048]);
    expect(context.calls).toContainEqual({ name: 'arc', values: [1024, 1024, 32, 0, Math.PI * 2] });
    expect(context.calls.filter((call) => call.name === 'lineTo')).toHaveLength(3);
    expect(context.lineWidth).toBeGreaterThan(0);
    expect(JSON.stringify(landmarks)).toBe(before);
  });

  it('draws exactly one numbered marker at the region centroid for one feedback item', () => {
    const context = new RecordingContext();
    const canvas = { width: 0, height: 0, getContext: () => context } as unknown as HTMLCanvasElement;
    const landmarks: readonly Landmark[] = [
      { name: 'left_hip', x: 0.2, y: 0.4, visibility: 1 },
      { name: 'left_knee', x: 0.4, y: 0.6, visibility: 1 },
      { name: 'left_ankle', x: 0.6, y: 0.8, visibility: 1 },
    ];
    const commands: readonly DrawingCommand[] = [
      { type: 'highlight-region', observationId: 'leg', joints: ['left_hip', 'left_knee', 'left_ankle'], label: 1 },
      { type: 'direction-arrow', observationId: 'leg', anchor: 'left_knee', dx: 0, dy: -0.1, label: 1 },
    ];

    drawAnnotatedPose(canvas, { width: 1000, height: 1000 } as unknown as CanvasImageSource, landmarks, commands);

    expect(context.calls.filter((call) => call.name === 'fillText')).toEqual([
      { name: 'fillText', values: '1' },
    ]);
    expect(context.calls.filter((call) => call.name === 'arc')).toEqual([
      { name: 'arc', values: [400, 600, 1000 / 64, 0, Math.PI * 2] },
    ]);
  });
});

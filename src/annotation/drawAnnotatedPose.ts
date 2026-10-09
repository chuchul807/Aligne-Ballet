import type { DrawingCommand, Landmark } from '../domain/types';

const MAX_RENDER_SIDE = 4096;
const SKELETON_COLOUR = '#9d6678';
const STRUCTURAL_OUTLINE_COLOUR = '#fff8fa';
const CORRECTION_COLOUR = '#35101f';
const LABEL_COLOUR = '#fff8fa';

function imageSize(image: CanvasImageSource): { width: number; height: number } {
  const sized = image as CanvasImageSource & { naturalWidth?: number; naturalHeight?: number; width?: number; height?: number };
  const width = sized.naturalWidth || sized.width;
  const height = sized.naturalHeight || sized.height;
  if (!width || !height) throw new Error('Image dimensions are required to draw annotations.');
  return { width, height };
}

function scaledDimensions(width: number, height: number): { width: number; height: number } {
  const scale = Math.min(1, MAX_RENDER_SIDE / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

export function drawAnnotatedPose(
  canvas: HTMLCanvasElement,
  image: CanvasImageSource,
  landmarks: readonly Landmark[],
  commands: readonly DrawingCommand[],
): HTMLCanvasElement {
  const source = imageSize(image);
  const dimensions = scaledDimensions(source.width, source.height);
  canvas.width = dimensions.width;
  canvas.height = dimensions.height;
  const context = canvas.getContext('2d');
  if (context === null) throw new Error('Canvas is unavailable for annotation rendering.');

  const pointByName = new Map(landmarks.map((landmark) => [landmark.name, { x: landmark.x * dimensions.width, y: landmark.y * dimensions.height }]));
  const shorterSide = Math.min(dimensions.width, dimensions.height);
  const lineWidth = Math.max(2, shorterSide / 512);
  const highlightRadius = Math.max(lineWidth * 4, shorterSide / 64);
  context.drawImage(image, 0, 0, dimensions.width, dimensions.height);

  for (const command of commands) {
    if (command.type !== 'skeleton-segment') continue;
    const from = pointByName.get(command.from);
    const to = pointByName.get(command.to);
    if (from === undefined || to === undefined) continue;
    context.beginPath();
    context.strokeStyle = SKELETON_COLOUR;
    context.lineWidth = lineWidth;
    context.moveTo(from.x, from.y);
    context.lineTo(to.x, to.y);
    context.stroke();
  }

  const structuralRadius = Math.max(2.5, shorterSide / 220);
  context.globalAlpha = 0.78;
  for (const command of commands) {
    if (command.type !== 'structural-joint') continue;
    const point = pointByName.get(command.joint);
    if (point !== undefined) drawNeutralJoint(context, point.x, point.y, structuralRadius);
  }
  context.globalAlpha = 1;

  const markedObservations = new Set<string>();
  for (const command of commands) {
    if (command.type === 'highlight-joint') {
      const point = pointByName.get(command.joint);
      if (point === undefined) continue;
      if (!markedObservations.has(command.observationId)) {
        drawMarker(context, point.x, point.y, highlightRadius, command.label);
        markedObservations.add(command.observationId);
      }
    }
    if (command.type === 'highlight-region') {
      const points = command.joints.flatMap((joint) => {
        const point = pointByName.get(joint);
        return point ? [point] : [];
      });
      if (points.length > 0 && !markedObservations.has(command.observationId)) {
        const centroid = points.reduce((total, point) => ({
          x: total.x + point.x / points.length,
          y: total.y + point.y / points.length,
        }), { x: 0, y: 0 });
        drawMarker(context, centroid.x, centroid.y, highlightRadius, command.label);
        markedObservations.add(command.observationId);
      }
    }
    if (command.type === 'direction-arrow') {
      const anchor = pointByName.get(command.anchor);
      if (anchor === undefined) continue;
      drawArrow(context, anchor.x, anchor.y, anchor.x + command.dx * dimensions.width, anchor.y + command.dy * dimensions.height, lineWidth);
      if (!markedObservations.has(command.observationId)) {
        drawMarker(context, anchor.x, anchor.y, highlightRadius, command.label);
        markedObservations.add(command.observationId);
      }
    }
  }

  return canvas;
}

function drawNeutralJoint(context: CanvasRenderingContext2D, x: number, y: number, radius: number): void {
  context.beginPath();
  context.fillStyle = SKELETON_COLOUR;
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = STRUCTURAL_OUTLINE_COLOUR;
  context.lineWidth = Math.max(1, radius / 4);
  context.stroke();
}

function drawMarker(context: CanvasRenderingContext2D, x: number, y: number, radius: number, label: 1 | 2 | 3): void {
  context.beginPath();
  context.strokeStyle = CORRECTION_COLOUR;
  context.lineWidth = Math.max(2, radius / 5);
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.stroke();
  context.fillStyle = CORRECTION_COLOUR;
  context.fill();
  context.fillStyle = LABEL_COLOUR;
  context.font = `bold ${Math.round(radius)}px sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(String(label), x, y);
}

function drawArrow(context: CanvasRenderingContext2D, startX: number, startY: number, endX: number, endY: number, lineWidth: number): void {
  const angle = Math.atan2(endY - startY, endX - startX);
  const headLength = Math.max(lineWidth * 5, 12);
  context.beginPath();
  context.strokeStyle = CORRECTION_COLOUR;
  context.lineWidth = lineWidth * 1.5;
  context.moveTo(startX, startY);
  context.lineTo(endX, endY);
  context.lineTo(endX - headLength * Math.cos(angle - Math.PI / 6), endY - headLength * Math.sin(angle - Math.PI / 6));
  context.moveTo(endX, endY);
  context.lineTo(endX - headLength * Math.cos(angle + Math.PI / 6), endY - headLength * Math.sin(angle + Math.PI / 6));
  context.stroke();
}

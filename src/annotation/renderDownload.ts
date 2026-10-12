import type { AnalysisResult } from '../domain/types';
import { poseLabel } from '../domain/poseLabel';

export const PRACTICE_DISCLAIMER = 'This feedback supports practice and does not replace guidance from a qualified ballet teacher.';

export interface DownloadRenderInput {
  image: CanvasImageSource;
  result: Pick<AnalysisResult, 'position' | 'topCorrections'>;
  generatedAt?: Date;
}

const colours = {
  page: '#f7dce1',
  deep: '#653246',
  ink: '#3f2831',
  muted: '#75515f',
} as const;

function imageSize(image: CanvasImageSource): { width: number; height: number } {
  const sized = image as CanvasImageSource & { naturalWidth?: number; naturalHeight?: number; width?: number; height?: number };
  const width = sized.naturalWidth || sized.width;
  const height = sized.naturalHeight || sized.height;
  if (!width || !height) throw new Error('Image dimensions are required to create a download.');
  return { width, height };
}

function wrapText(context: CanvasRenderingContext2D, text: string, maxWidth: number): readonly string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const candidate = line === '' ? word : `${line} ${word}`;
    if (line !== '' && context.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line !== '') lines.push(line);
  return lines;
}

function ordinalSuffix(day: number): string {
  const lastTwoDigits = day % 100;
  if (lastTwoDigits >= 11 && lastTwoDigits <= 13) return 'th';
  if (day % 10 === 1) return 'st';
  if (day % 10 === 2) return 'nd';
  if (day % 10 === 3) return 'rd';
  return 'th';
}

function formatDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? '';
  const day = Number(part('day'));
  return `${part('month')} ${day}${ordinalSuffix(day)} ${part('year')}`;
}

function drawLines(
  context: CanvasRenderingContext2D,
  lines: readonly string[],
  x: number,
  y: number,
  lineHeight: number,
): number {
  lines.forEach((line, index) => context.fillText(line, x, y + index * lineHeight));
  return y + lines.length * lineHeight;
}

export function renderDownload(input: DownloadRenderInput): Promise<Blob> {
  const source = imageSize(input.image);
  const width = source.width;
  const padding = Math.max(24, Math.round(width * 0.055));
  const contentWidth = width - padding * 2;
  const imageWidth = contentWidth;
  const imageHeight = Math.round(source.height * (imageWidth / source.width));
  const imageRadius = Math.max(12, Math.round(width * 0.02));

  const dateFontSize = Math.max(18, Math.round(width * 0.0373));
  const positionFontSize = Math.max(20, Math.round(width * 0.0395));
  const headingFontSize = Math.max(26, Math.round(width * 0.0526));
  const bodyFontSize = Math.max(16, Math.round(width * 0.0351));
  const disclaimerFontSize = Math.max(12, Math.round(width * 0.0219));

  const dateLineHeight = Math.round(dateFontSize * 1.24);
  const positionLineHeight = Math.round(positionFontSize * 1.2);
  const headingLineHeight = Math.round(headingFontSize * 1.14);
  const bodyLineHeight = Math.round(bodyFontSize * 1.43);
  const disclaimerLineHeight = Math.round(disclaimerFontSize * 1.36);

  const dateGap = Math.max(18, Math.round(width * 0.0373));
  const positionGap = Math.max(22, Math.round(width * 0.0439));
  const headingGap = Math.max(14, Math.round(width * 0.0285));
  const correctionsGap = Math.max(18, Math.round(width * 0.033));
  const correctionItemGap = Math.max(6, Math.round(width * 0.0088));
  const disclaimerGap = Math.max(24, Math.round(width * 0.0384));

  const generatedAt = input.generatedAt ?? new Date();
  const date = formatDate(generatedAt);
  const position = poseLabel(input.result.position);
  const topCorrections = input.result.topCorrections.slice(0, 3);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  const context = canvas.getContext('2d');
  if (context === null) return Promise.reject(new Error('Canvas is unavailable for download rendering.'));

  context.font = `400 ${bodyFontSize}px Inter, ui-sans-serif, system-ui, sans-serif`;
  const correctionLines = topCorrections.map((item, index) => wrapText(context, `${index + 1}. ${item.text}`, contentWidth));
  const correctionsHeight = correctionLines.reduce((height, lines, index) => (
    height + lines.length * bodyLineHeight + (index < correctionLines.length - 1 ? correctionItemGap : 0)
  ), 0);

  context.font = `400 ${disclaimerFontSize}px Inter, ui-sans-serif, system-ui, sans-serif`;
  const disclaimerLines = wrapText(context, PRACTICE_DISCLAIMER, contentWidth);
  const disclaimerHeight = disclaimerLines.length * disclaimerLineHeight;

  const imageY = padding + dateLineHeight + dateGap;
  const positionY = imageY + imageHeight + positionGap;
  const headingY = positionY + positionLineHeight + headingGap;
  const correctionsY = headingY + headingLineHeight + correctionsGap;
  const correctionsBottom = correctionsY + correctionsHeight;
  const minimumHeight = Math.round(width * (1543 / 912));
  const disclaimerY = Math.max(correctionsBottom + disclaimerGap, minimumHeight - padding - disclaimerHeight);
  const height = Math.max(minimumHeight, disclaimerY + disclaimerHeight + padding);

  canvas.height = height;
  context.textBaseline = 'top';
  context.fillStyle = colours.page;
  context.fillRect(0, 0, width, height);

  context.fillStyle = colours.deep;
  context.font = `700 ${dateFontSize}px Georgia, serif`;
  context.fillText(date, padding, padding);

  context.save();
  context.beginPath();
  context.roundRect(padding, imageY, imageWidth, imageHeight, imageRadius);
  context.clip();
  context.drawImage(input.image, padding, imageY, imageWidth, imageHeight);
  context.restore();

  context.fillStyle = colours.deep;
  context.font = `700 ${positionFontSize}px Georgia, serif`;
  context.fillText(position, padding, positionY);

  context.font = `700 ${headingFontSize}px Georgia, serif`;
  context.fillText('Your Feedback:', padding, headingY);

  context.fillStyle = colours.ink;
  context.font = `400 ${bodyFontSize}px Inter, ui-sans-serif, system-ui, sans-serif`;
  let correctionY = correctionsY;
  correctionLines.forEach((lines, index) => {
    correctionY = drawLines(context, lines, padding, correctionY, bodyLineHeight);
    if (index < correctionLines.length - 1) correctionY += correctionItemGap;
  });

  context.fillStyle = colours.muted;
  context.font = `400 ${disclaimerFontSize}px Inter, ui-sans-serif, system-ui, sans-serif`;
  drawLines(context, disclaimerLines, padding, disclaimerY, disclaimerLineHeight);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob === null) reject(new Error('Unable to create downloadable PNG.'));
      else resolve(blob);
    }, 'image/png');
  });
}

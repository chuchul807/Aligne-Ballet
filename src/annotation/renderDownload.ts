import type { AnalysisResult } from '../domain/types';

export const PRACTICE_DISCLAIMER = 'This feedback supports practice and does not replace guidance from a qualified ballet teacher.';

export interface DownloadRenderInput {
  image: CanvasImageSource;
  result: Pick<AnalysisResult, 'position' | 'topCorrections'>;
  generatedAt?: Date;
}

function imageSize(image: CanvasImageSource): { width: number; height: number } {
  const sized = image as CanvasImageSource & { naturalWidth?: number; naturalHeight?: number; width?: number; height?: number };
  const width = sized.naturalWidth || sized.width;
  const height = sized.naturalHeight || sized.height;
  if (!width || !height) throw new Error('Image dimensions are required to create a download.');
  return { width, height };
}

function titleCasePosition(position: AnalysisResult['position']): string {
  return position === 'attitude-derriere' ? 'Attitude derrière' : position === 'retire-passe' ? 'Retiré / Passé' : 'Arabesque';
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

export function renderDownload(input: DownloadRenderInput): Promise<Blob> {
  const source = imageSize(input.image);
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (context === null) return Promise.reject(new Error('Canvas is unavailable for download rendering.'));
  const padding = Math.max(24, Math.round(source.width * 0.05));
  const width = source.width;
  const lineHeight = Math.max(24, Math.round(width * 0.05));
  const font = `${Math.max(16, Math.round(width * 0.045))}px sans-serif`;
  canvas.width = width;
  context.font = font;
  const generatedAt = input.generatedAt ?? new Date();
  const date = generatedAt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
  const topCorrections = input.result.topCorrections.slice(0, 3);
  const lines = [
    ...wrapText(context, titleCasePosition(input.result.position), width - padding * 2),
    ...topCorrections.flatMap((item, index) => wrapText(context, `${index + 1}. ${item.text}`, width - padding * 2)),
    ...wrapText(context, PRACTICE_DISCLAIMER, width - padding * 2),
    ...wrapText(context, `Generated ${date}`, width - padding * 2),
  ];
  const textHeight = padding * 2 + lineHeight * (lines.length + 1);
  canvas.width = width;
  canvas.height = source.height + textHeight;
  context.drawImage(input.image, 0, 0, width, source.height);
  context.fillStyle = '#f7e6eb';
  context.fillRect(0, source.height, width, textHeight);
  context.fillStyle = '#35101f';
  context.font = font;
  context.textBaseline = 'top';
  lines.forEach((line, index) => context.fillText(line, padding, source.height + padding + index * lineHeight));

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob === null) reject(new Error('Unable to create downloadable PNG.'));
      else resolve(blob);
    }, 'image/png');
  });
}

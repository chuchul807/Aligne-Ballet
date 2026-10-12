export interface DecodedPixelData {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export interface ImageMetrics {
  meanLuminance: number;
  contrast: number;
  edgeEnergy: number;
}

function luminance(data: Uint8ClampedArray, pixelIndex: number): number {
  const offset = pixelIndex * 4;
  return ((data[offset] ?? 0) * 0.2126 + (data[offset + 1] ?? 0) * 0.7152 + (data[offset + 2] ?? 0) * 0.0722) / 255;
}

export function calculateImageMetrics({ width, height, data }: DecodedPixelData): ImageMetrics {
  const pixelCount = width * height;
  if (width <= 0 || height <= 0 || data.length < pixelCount * 4) {
    return { meanLuminance: 0, contrast: 0, edgeEnergy: 0 };
  }

  const values = Array.from({ length: pixelCount }, (_, index) => luminance(data, index));
  const meanLuminance = values.reduce((sum, value) => sum + value, 0) / pixelCount;
  const contrast = Math.sqrt(values.reduce((sum, value) => sum + (value - meanLuminance) ** 2, 0) / pixelCount);

  const gradients: number[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      if (x + 1 < width) {
        gradients.push(Math.abs((values[index] ?? 0) - (values[index + 1] ?? 0)));
      }
      if (y + 1 < height) {
        gradients.push(Math.abs((values[index] ?? 0) - (values[index + width] ?? 0)));
      }
    }
  }

  gradients.sort((a, b) => b - a);
  const strongestGradientCount = Math.min(gradients.length, Math.max(1, Math.ceil(Math.max(width, height) * 4)));
  const strongestGradientTotal = gradients
    .slice(0, strongestGradientCount)
    .reduce((sum, value) => sum + value, 0);

  return {
    meanLuminance,
    contrast,
    edgeEnergy: gradients.length === 0 ? 0 : strongestGradientTotal / strongestGradientCount,
  };
}

export function measureImageMetrics(source: CanvasImageSource, width: number, height: number): ImageMetrics {
  const scale = Math.min(1, 256 / Math.max(width, height));
  const sampleWidth = Math.max(1, Math.round(width * scale));
  const sampleHeight = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = sampleWidth;
  canvas.height = sampleHeight;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return { meanLuminance: 0, contrast: 0, edgeEnergy: 0 };

  context.drawImage(source, 0, 0, sampleWidth, sampleHeight);
  const pixels = context.getImageData(0, 0, sampleWidth, sampleHeight);
  return calculateImageMetrics(pixels);
}

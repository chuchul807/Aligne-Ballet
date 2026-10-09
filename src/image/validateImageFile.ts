export type ImageErrorCode =
  | 'unsupported-type'
  | 'file-too-large'
  | 'image-too-small'
  | 'normalisation-failed'
  | 'image-memory-failed'
  | 'decode-failed';

export type ImageFileValidation =
  | { ok: true }
  | { ok: false; code: Extract<ImageErrorCode, 'unsupported-type' | 'file-too-large'> };

const ACCEPTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_FILE_SIZE = 12 * 1024 * 1024;

export function validateImageFile(file: File): ImageFileValidation {
  if (!ACCEPTED_IMAGE_TYPES.has(file.type)) {
    return { ok: false, code: 'unsupported-type' };
  }

  return file.size > MAX_FILE_SIZE ? { ok: false, code: 'file-too-large' } : { ok: true };
}

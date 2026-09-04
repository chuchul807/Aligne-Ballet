import { describe, expect, it } from 'vitest';
import { validateImageFile } from './validateImageFile';

describe('validateImageFile', () => {
  it.each(['image/jpeg', 'image/png', 'image/webp'])('accepts %s', (type) => {
    expect(validateImageFile(new File(['x'], 'pose', { type }))).toEqual({ ok: true });
  });

  it('rejects an unsupported file type', () => {
    expect(validateImageFile(new File(['x'], 'pose.gif', { type: 'image/gif' }))).toEqual({
      ok: false,
      code: 'unsupported-type',
    });
  });

  it('rejects a file above 12 MiB', () => {
    const file = new File([new Uint8Array(12 * 1024 * 1024 + 1)], 'pose.jpg', { type: 'image/jpeg' });
    expect(validateImageFile(file)).toEqual({ ok: false, code: 'file-too-large' });
  });
});

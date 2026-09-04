import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useObjectUrl } from './useObjectUrl';

const firstFile = new File(['first'], 'first.jpg', { type: 'image/jpeg' });
const secondFile = new File(['second'], 'second.jpg', { type: 'image/jpeg' });

describe('useObjectUrl', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('revokes the previous URL when the file changes', () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL');
    const { rerender } = renderHook(({ file }) => useObjectUrl(file), { initialProps: { file: firstFile } });

    rerender({ file: secondFile });

    expect(revoke).toHaveBeenCalledTimes(1);
  });

  it('revokes the current URL when unmounted', () => {
    const revoke = vi.spyOn(URL, 'revokeObjectURL');
    const { unmount } = renderHook(() => useObjectUrl(firstFile));

    unmount();

    expect(revoke).toHaveBeenCalledTimes(1);
  });
});

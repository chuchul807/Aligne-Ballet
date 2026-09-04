import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FrameCard } from './FrameCard';

afterEach(cleanup);

describe('FrameCard', () => {
  it('offers JPEG, PNG, and WebP files and shows the selected-view guide', () => {
    render(<FrameCard view="three-quarter-side" onFileSelected={vi.fn()} />);

    expect(screen.getByLabelText('Choose a photo')).toHaveAttribute('accept', 'image/jpeg,image/png,image/webp');
    expect(screen.getByText('Three-quarter side guide')).toBeInTheDocument();
  });

  it('keeps a selected image only in component state before handing it to the caller', async () => {
    const onFileSelected = vi.fn();
    const user = userEvent.setup({ applyAccept: false });
    render(<FrameCard view="front" onFileSelected={onFileSelected} />);
    const file = new File(['image'], 'pose.jpg', { type: 'image/jpeg' });

    const input = screen.getByLabelText<HTMLInputElement>('Choose a photo');
    await user.upload(input, file);

    expect(input.files).toHaveLength(1);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(onFileSelected).toHaveBeenCalledOnce();
    expect(onFileSelected).toHaveBeenCalledWith(file);
  });
});

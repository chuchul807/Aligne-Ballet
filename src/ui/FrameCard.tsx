import { useState } from 'react';
import type { ViewType } from '../domain/types';
import { useObjectUrl } from '../session/useObjectUrl';
import { validateImageFile, type ImageErrorCode } from '../image/validateImageFile';

interface FrameCardProps {
  view: ViewType;
  onFileSelected: (file: File) => void;
}

const guides: Record<ViewType, { title: string; instruction: string }> = {
  front: {
    title: 'Front view guide',
    instruction: 'Face the camera with your full body visible, from head to pointed toes.',
  },
  'three-quarter-side': {
    title: 'Three-quarter side guide',
    instruction: 'Turn slightly to the side so your full body and working leg line are visible.',
  },
};

const errors: Record<Extract<ImageErrorCode, 'unsupported-type' | 'file-too-large'>, string> = {
  'unsupported-type': 'Choose a JPEG, PNG, or WebP photo.',
  'file-too-large': 'Choose a photo that is 12 MiB or smaller.',
};

export function FrameCard({ view, onFileSelected }: FrameCardProps) {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const previewUrl = useObjectUrl(file);
  const guide = guides[view];

  const selectFile = (nextFile: File | undefined) => {
    if (!nextFile) return;

    const validation = validateImageFile(nextFile);
    if (!validation.ok) {
      setError(errors[validation.code]);
      return;
    }

    setError(null);
    setFile(nextFile);
    onFileSelected(nextFile);
  };

  return (
    <section className="frame-card" aria-label="Photo framing">
      <p className="stage-kicker">Photo guide</p>
      <h2>{guide.title}</h2>
      <p>{guide.instruction}</p>

      <label htmlFor="pose-photo">Choose a photo</label>
      <input
        id="pose-photo"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(event) => selectFile(event.target.files?.[0])}
      />

      {error && <p role="alert">{error}</p>}
      {previewUrl && <img src={previewUrl} alt="Selected pose preview" />}
    </section>
  );
}

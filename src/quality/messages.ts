import type { QualityReasonCode } from './types';

export const QUALITY_MESSAGES: Record<QualityReasonCode, string> = {
  'no-person': 'No full body was detected. Step back and try again.',
  'multiple-people': 'Only one dancer can be analysed at a time.',
  'body-out-of-frame': 'Keep your hands and feet inside the frame.',
  'required-joints-not-visible': 'Make sure your hips, knees, ankles, and feet are visible.',
  'insufficient-pose-evidence': 'Retake the photo with your whole body clearly visible, including shoulders, hips, knees, ankles, and feet.',
  'subject-too-small': 'Move closer while keeping your full body, hands, and feet in the frame.',
  'unstable-pose-landmarks': 'Retake the photo closer, with less clothing, barre, or limb overlap around the joints.',
  'wrong-camera-view': 'Match the camera angle shown in the framing guide.',
  'too-dark': 'Use brighter, even lighting and try again.',
  'too-bright': 'Reduce glare or backlighting and try again.',
  'low-contrast': 'Use clearer lighting and fitted clothing that contrasts with the background.',
  blurred: 'Hold the camera steady and retake the photo.',
  'image-too-small': 'Image is too small. Choose a photo with a shortest side of at least 480 pixels.',
  'normalisation-failed': 'This photo could not be resized on this device. Try a smaller export or retake the photo.',
  'image-memory-failed': 'This photo could not be decoded with the memory available on this device. Try a smaller export or retake the photo.',
  'decode-failed': 'This photo could not be decoded on this device. Try a smaller export or retake the photo.',
};

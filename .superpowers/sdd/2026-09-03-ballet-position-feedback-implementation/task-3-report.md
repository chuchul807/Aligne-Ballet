# Task 3 Report: Private Image Intake and Decoding

## Implementation

- Added browser-local file validation for JPEG, PNG, and WebP files up to 12 MiB.
- Added image decoding through `createImageBitmap(file, { imageOrientation: 'from-image' })`, with a temporary-object-URL `HTMLImageElement` fallback. Both paths enforce the 480px shortest-side minimum and 8192px maximum-side limit, expose exact error codes, and provide idempotent resource disposal.
- Added `useObjectUrl`, which revokes object URLs when a file is replaced or the consuming component unmounts.
- Added `FrameCard`, including a constrained file picker, view-specific English camera guidance, in-memory preview, and validation feedback. It does not persist, upload, or otherwise externalize image bytes.

## Files

- `src/image/validateImageFile.ts`
- `src/image/validateImageFile.test.ts`
- `src/image/decodeImage.ts`
- `src/image/decodeImage.test.ts`
- `src/session/useObjectUrl.ts`
- `src/session/useObjectUrl.test.tsx`
- `src/ui/FrameCard.tsx`
- `src/ui/FrameCard.test.tsx`

## RED / GREEN Evidence

- RED: `pnpm test -- src/image/validateImageFile.test.ts` failed because `./validateImageFile` did not exist.
- GREEN: the same command passed after the minimal validation implementation.
- RED: `pnpm test -- src/session/useObjectUrl.test.tsx` failed because `./useObjectUrl` did not exist.
- GREEN: the same command passed after lifecycle cleanup implementation.
- RED: `pnpm test -- src/image/decodeImage.test.ts` and `pnpm test -- src/ui/FrameCard.test.tsx` each failed because their production modules did not exist.
- GREEN: both passed after the decoder and card were implemented.

## Final Verification

- Focused: `pnpm test -- src/image src/session/useObjectUrl.test.tsx` — 8 files, 18 tests passed.
- Full: `pnpm test` — 8 files, 18 tests passed.
- Build: `pnpm build` — TypeScript check and Vite production build passed.

## Self-review

- Reviewed every new source and test file and ran whitespace checks on all production additions.
- Verified only supported types, exact file-size/dimension error codes, object URL cleanup, image-bitmap cleanup, and mobile-compatible picker constraints are present.
- No local storage, IndexedDB, upload, analytics, or backend code was added.

## Concerns

- `FrameCard` is intentionally standalone. Task 11 still needs to connect its `onFileSelected` callback to the reducer and decoding/quality pipeline while retaining the selected file in React state.

# Refined Pose Detection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace single-pass Lite-model pose detection with Heavy-model, dancer-focused two-pass detection that suppresses feedback and annotations from unstable joints.

**Architecture:** Keep MediaPipe behind the existing `PoseDetector` boundary. Add pure crop and agreement modules plus a still-photo refinement coordinator above that boundary; feed its mapped landmarks and disagreement evidence into the existing quality, reliability, measurement, rule, feedback, and annotation pipeline.

**Tech Stack:** React 19, TypeScript 7, Vite 8, Vitest 4, Playwright, MediaPipe Tasks Vision 1.x, HTML canvas.

**Spec:** `docs/superpowers/specs/2026-09-15-refined-pose-detection-design.md`

## Global Constraints

- Use MediaPipe Pose Landmarker Heavy for both passes; do not keep Lite as a runtime fallback.
- Keep `IMAGE` mode and `numPoses: 2` so multiple-person photos remain rejectable.
- Keep all photo pixels and inference in the browser; do not upload, persist, log, or add user photos to source control.
- Use `0.60` as the minimum visibility and optional presence score.
- Reject a subject when torso length is below `48` source pixels or visible body extent is below `180` source pixels.
- Pad the detected dancer box by `20%` per side and clamp it to the source image.
- Use `0.12` refined-torso lengths for major-joint agreement and `0.18` for face, hands, and feet.
- Never use a cross-pass-disagreeing landmark for measurements, corrections, highlights, structural joints, or skeleton segments.
- Preserve existing position thresholds, viability quorums, mobile single-card flow, image normalization, and download behavior.
- Do not publish a new site version until the full verification task passes and the user explicitly approves publishing.

---

## File Structure

**Create**

- `src/pose/focusedCrop.ts` — subject-size checks, padded crop geometry, crop canvas ownership, and coordinate mapping.
- `src/pose/focusedCrop.test.ts` — size, padding, edge-clamping, mapping, and disposal tests.
- `src/pose/poseAgreement.ts` — pure cross-pass per-landmark agreement calculation.
- `src/pose/poseAgreement.test.ts` — major/flexible threshold and invalid-evidence tests.
- `src/pose/refinePoseDetection.ts` — one focused detector pass using a completed whole-image pass.
- `src/pose/refinePoseDetection.test.ts` — detector call, remapping, outcome, and cleanup tests.

**Modify**

- `scripts/sync-mediapipe-assets.mjs` — fetch Heavy instead of Lite.
- `src/pose/MediaPipePoseDetector.ts` and `.test.ts` — Heavy asset configuration and optional presence mapping.
- `src/domain/types.ts` and `.test.ts` — optional landmark presence and new reliability reasons.
- `src/reliability/evaluateLandmarkReliability.ts` and `.test.ts` — presence and cross-pass disagreement gating.
- `src/quality/evaluateQuality.ts` and `.test.ts` — defer required-joint visibility during the whole-image pass.
- `src/quality/types.ts`, `src/quality/messages.ts` — subject-too-small and unstable-landmark retake reasons.
- `src/pipeline/analyzePose.ts` and `.test.ts` — orchestrate whole-image quality, refinement, refined quality, reliability, and viability.
- `src/feedback/composeFeedback.ts` and `.test.ts` — clearer conservative copy for unassessable regions.
- `src/ui/CheckCard.tsx` and `.test.tsx` — explain partial assessment without detector jargon.
- `src/app/App.test.tsx` and `tests/e2e/mobile-flow.spec.ts` — inject stable refinement in UI tests and retain privacy assertions.

---

### Task 1: Upgrade the MediaPipe adapter to Heavy and preserve presence

**Files:**
- Modify: `scripts/sync-mediapipe-assets.mjs`
- Modify: `src/domain/types.ts`
- Modify: `src/domain/types.test.ts`
- Modify: `src/pose/MediaPipePoseDetector.ts`
- Modify: `src/pose/MediaPipePoseDetector.test.ts`

**Interfaces:**
- Produces: `Landmark.presence?: number`.
- Produces: `POSE_MODEL_ASSET_PATH = '/models/pose_landmarker_heavy.task'`.
- Preserves: `PoseDetector.detect(source, width, height): Promise<LandmarkSet>`.

- [ ] **Step 1: Write failing adapter and domain tests**

Extend `fakePerson` in `MediaPipePoseDetector.test.ts` to include `presence`, then add assertions:

```ts
import { mapMediaPipeResult, POSE_MODEL_ASSET_PATH } from './MediaPipePoseDetector';

expect(POSE_MODEL_ASSET_PATH).toBe('/models/pose_landmarker_heavy.task');
expect(mapped.people[0]?.find((point) => point.name === 'left_knee')).toMatchObject({
  visibility: 0.93,
  presence: 0.88,
});
```

Add a type-level/runtime fixture in `src/domain/types.test.ts` proving `presence` is retained:

```ts
const landmark: Landmark = {
  name: 'left_knee', x: 0.4, y: 0.6, z: -0.1, visibility: 0.9, presence: 0.85,
};
expect(landmark.presence).toBe(0.85);
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
pnpm test -- src/pose/MediaPipePoseDetector.test.ts src/domain/types.test.ts
```

Expected: FAIL because `presence` is not mapped and `POSE_MODEL_ASSET_PATH` is not exported.

- [ ] **Step 3: Implement the minimal adapter and asset changes**

Add `presence?: number` to `Landmark` and `presence?: number` to the local MediaPipe result type. With `exactOptionalPropertyTypes`, include the property only when it is finite:

```ts
export const POSE_MODEL_ASSET_PATH = '/models/pose_landmarker_heavy.task';

const mapped = {
  name: landmarkNames[index]!,
  x: point.x,
  y: point.y,
  z: point.z,
  visibility: point.visibility,
};
return point.presence !== undefined && Number.isFinite(point.presence)
  ? { ...mapped, presence: point.presence }
  : mapped;
```

Use `POSE_MODEL_ASSET_PATH` in `createFromOptions`, retain `runningMode: 'IMAGE'`, and retain `numPoses: 2`.

In `scripts/sync-mediapipe-assets.mjs`, replace the Lite URL/path/name with:

```js
const modelUrl = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task';
const modelPath = new URL('pose_landmarker_heavy.task', modelDirectory);
```

Use the Heavy filename for the temporary download as well.

- [ ] **Step 4: Verify GREEN**

Run:

```bash
pnpm test -- src/pose/MediaPipePoseDetector.test.ts src/domain/types.test.ts
pnpm exec tsc --noEmit
```

Expected: both commands exit `0`; the adapter test confirms Heavy configuration and presence mapping.

- [ ] **Step 5: Commit**

```bash
git add scripts/sync-mediapipe-assets.mjs src/domain/types.ts src/domain/types.test.ts src/pose/MediaPipePoseDetector.ts src/pose/MediaPipePoseDetector.test.ts
git commit -m "feat: upgrade pose detector to heavy model"
```

---

### Task 2: Add subject-size and focused-crop geometry

**Files:**
- Create: `src/pose/focusedCrop.ts`
- Create: `src/pose/focusedCrop.test.ts`

**Interfaces:**
- Produces: `assessSubjectSize(landmarks, sourceWidth, sourceHeight): SubjectSizeAssessment`.
- Produces: `calculateFocusRect(landmarks, sourceWidth, sourceHeight): CropRect | null`.
- Produces: `createFocusedCrop(source, rect, canvasFactory?): FocusedCrop`.
- Produces: `mapLandmarksFromCrop(landmarks, rect, sourceWidth, sourceHeight): readonly Landmark[]`.

- [ ] **Step 1: Write failing pure-geometry tests**

Create `focusedCrop.test.ts` with controlled landmarks. Cover exact boundaries, padding, edge clamping, and remapping:

```ts
it('accepts the exact minimum pixel evidence', () => {
  const person = sizedPerson({ torsoNormalised: 0.048, extentNormalised: 0.18 });
  expect(assessSubjectSize(person, 1000, 1000)).toMatchObject({ status: 'usable' });
});

it('rejects a dancer whose torso is under 48 source pixels', () => {
  const person = sizedPerson({ torsoNormalised: 0.047, extentNormalised: 0.30 });
  expect(assessSubjectSize(person, 1000, 1000)).toEqual({ status: 'too-small' });
});

it('pads every side by 20 percent and clamps at the image edge', () => {
  const rect = calculateFocusRect(boxPerson(0.10, 0.20, 0.80, 0.90), 1000, 1000);
  expect(rect).toEqual({ left: 0, top: 60, width: 940, height: 940 });
});

it('maps crop coordinates back to the original image', () => {
  const mapped = mapLandmarksFromCrop([
    { name: 'left_knee', x: 0.5, y: 0.25, visibility: 0.9 },
  ], { left: 200, top: 100, width: 400, height: 800 }, 1000, 1200);
  expect(mapped[0]).toMatchObject({ x: 0.4, y: 0.25 });
});
```

The `boxPerson` test builder must include reliable shoulders, hips, and one ankle so the crop meets the specification's minimum evidence.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
pnpm test -- src/pose/focusedCrop.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement the geometry functions**

Define these exported constants and types:

```ts
export const MIN_SUBJECT_VISIBILITY = 0.60;
export const MIN_TORSO_PIXELS = 48;
export const MIN_BODY_EXTENT_PIXELS = 180;
export const FOCUS_PADDING_RATIO = 0.20;

export interface CropRect { left: number; top: number; width: number; height: number }
export type SubjectSizeAssessment =
  | { status: 'usable'; torsoPixels: number; bodyExtentPixels: number }
  | { status: 'insufficient-evidence' }
  | { status: 'too-small' };
```

Use shoulder/hip midpoints for torso length. Build the pixel-space bounding box from finite, in-frame landmarks meeting visibility and optional presence `>= 0.60`. Require both shoulders, both hips, and at least one ankle before returning a crop. Expand each horizontal side by `bbox.width * 0.20` and each vertical side by `bbox.height * 0.20`, then clamp.

- [ ] **Step 4: Add a failing canvas ownership test**

Use an injected fake canvas with a `drawImage` spy. Assert native crop dimensions, capped longest side, and cleanup:

```ts
const crop = createFocusedCrop(source, { left: 100, top: 200, width: 5000, height: 2500 }, fakeCanvasFactory);
expect([crop.width, crop.height]).toEqual([4096, 2048]);
expect(drawImage).toHaveBeenCalledWith(source, 100, 200, 5000, 2500, 0, 0, 4096, 2048);
crop.dispose();
expect(canvas.width).toBe(0);
expect(canvas.height).toBe(0);
```

- [ ] **Step 5: Implement crop canvas ownership and verify GREEN**

Return `{ source, width, height, rect, dispose }`. Make `dispose()` idempotent and set both canvas dimensions to zero once. Throw `{ code: 'image-memory-failed' }` if canvas creation or drawing fails.

Run:

```bash
pnpm test -- src/pose/focusedCrop.test.ts
pnpm exec tsc --noEmit
```

Expected: all focused tests pass and TypeScript exits `0`.

- [ ] **Step 6: Commit**

```bash
git add src/pose/focusedCrop.ts src/pose/focusedCrop.test.ts
git commit -m "feat: add focused dancer crop geometry"
```

---

### Task 3: Add cross-pass landmark agreement

**Files:**
- Create: `src/pose/poseAgreement.ts`
- Create: `src/pose/poseAgreement.test.ts`

**Interfaces:**
- Produces: `comparePosePasses(whole, refined): ReadonlySet<LandmarkName>` containing every unstable landmark.
- Consumes: full-image-normalized landmarks from both passes.

- [ ] **Step 1: Write threshold and invalid-evidence tests**

Use `landmarkPerson()` whose torso length is `0.4`. Add tests that demonstrate the two threshold groups:

```ts
it('rejects a knee beyond 0.12 torso lengths', () => {
  const refined = move(landmarkPerson(), 'left_knee', 0.049);
  expect(comparePosePasses(landmarkPerson(), refined)).toContain('left_knee');
});

it('keeps a wrist within 0.18 torso lengths', () => {
  const refined = move(landmarkPerson(), 'left_wrist', 0.070);
  expect(comparePosePasses(landmarkPerson(), refined)).not.toContain('left_wrist');
});

it.each([
  ['missing', without(landmarkPerson(), 'right_hip')],
  ['low visibility', update(landmarkPerson(), 'right_hip', { visibility: 0.59 })],
  ['low presence', update(landmarkPerson(), 'right_hip', { presence: 0.59 })],
] as const)('marks %s cross-pass evidence unstable', (_label, whole) => {
  expect(comparePosePasses(whole, landmarkPerson())).toContain('right_hip');
});
```

- [ ] **Step 2: Run the test and verify RED**

```bash
pnpm test -- src/pose/poseAgreement.test.ts
```

Expected: FAIL because `comparePosePasses` does not exist.

- [ ] **Step 3: Implement agreement**

Export:

```ts
export const MAJOR_JOINT_AGREEMENT = 0.12;
export const FLEXIBLE_JOINT_AGREEMENT = 0.18;
export function comparePosePasses(
  whole: readonly Landmark[],
  refined: readonly Landmark[],
): ReadonlySet<LandmarkName>;
```

The major group is shoulders, elbows, hips, knees, and ankles. All face points, wrists, finger points, heels, and foot-index points use the flexible threshold. Treat missing, non-finite, out-of-frame, visibility `< 0.60`, and defined presence `< 0.60` as unstable before measuring distance. If the refined torso cannot be calculated or is non-positive, return every landmark name as unstable.

- [ ] **Step 4: Verify GREEN**

```bash
pnpm test -- src/pose/poseAgreement.test.ts
pnpm exec tsc --noEmit
```

Expected: both commands exit `0`.

- [ ] **Step 5: Commit**

```bash
git add src/pose/poseAgreement.ts src/pose/poseAgreement.test.ts
git commit -m "feat: compare whole and focused pose landmarks"
```

---

### Task 4: Coordinate the focused detection pass and guarantee cleanup

**Files:**
- Create: `src/pose/refinePoseDetection.ts`
- Create: `src/pose/refinePoseDetection.test.ts`

**Interfaces:**
- Consumes: one-person whole-image `LandmarkSet`, decoded source, dimensions, and `PoseDetector`.
- Produces:

```ts
export type RefinedPoseOutcome =
  | { status: 'success'; landmarks: LandmarkSet; disagreements: ReadonlySet<LandmarkName> }
  | { status: 'subject-too-small' }
  | { status: 'insufficient-pose-evidence' }
  | { status: 'unstable-pose-landmarks' };

export function refinePoseDetection(input: RefinePoseInput): Promise<RefinedPoseOutcome>;
```

- [ ] **Step 1: Write failing success and outcome tests**

Build a fake canvas factory and a detector whose focused result contains known crop coordinates. Assert:

```ts
expect(detector.detect).toHaveBeenCalledOnce();
expect(detector.detect).toHaveBeenCalledWith(cropCanvas, cropWidth, cropHeight);
expect(outcome).toMatchObject({
  status: 'success',
  landmarks: { sourceWidth: 1000, sourceHeight: 1500 },
});
expect(outcome.status === 'success' && outcome.landmarks.people[0]?.find((point) => point.name === 'left_knee'))
  .toMatchObject({ x: expectedFullX, y: expectedFullY });
```

Add separate tests for `subject-too-small`, insufficient crop evidence, no refined person, and multiple refined people. Verify the detector is not called for pre-crop failures.

- [ ] **Step 2: Run the coordinator test and verify RED**

```bash
pnpm test -- src/pose/refinePoseDetection.test.ts
```

Expected: FAIL because the coordinator does not exist.

- [ ] **Step 3: Implement the minimal coordinator**

Flow:

```ts
const person = input.whole.people[0];
if (!person) return { status: 'insufficient-pose-evidence' };
const size = assessSubjectSize(person, input.width, input.height);
if (size.status === 'too-small') return { status: 'subject-too-small' };
if (size.status !== 'usable') return { status: 'insufficient-pose-evidence' };
const rect = calculateFocusRect(person, input.width, input.height);
if (!rect) return { status: 'insufficient-pose-evidence' };

const crop = createFocusedCrop(input.source, rect, input.canvasFactory);
try {
  const detected = await input.detector.detect(crop.source, crop.width, crop.height);
  if (detected.people.length !== 1) return { status: 'unstable-pose-landmarks' };
  const mapped = mapLandmarksFromCrop(detected.people[0]!, rect, input.width, input.height);
  return {
    status: 'success',
    landmarks: { people: [mapped], sourceWidth: input.width, sourceHeight: input.height },
    disagreements: comparePosePasses(person, mapped),
  };
} finally {
  crop.dispose();
}
```

- [ ] **Step 4: Add failing cleanup tests for detector rejection and invalid person count**

```ts
await expect(refinePoseDetection(inputWithRejectingDetector)).rejects.toThrow('detector failed');
expect(dispose).toHaveBeenCalledOnce();

expect(await refinePoseDetection(inputWithNoRefinedPerson)).toEqual({ status: 'unstable-pose-landmarks' });
expect(dispose).toHaveBeenCalledOnce();
```

- [ ] **Step 5: Verify GREEN**

```bash
pnpm test -- src/pose/refinePoseDetection.test.ts src/pose/focusedCrop.test.ts src/pose/poseAgreement.test.ts
pnpm exec tsc --noEmit
```

Expected: all tests pass; every post-crop path disposes exactly once.

- [ ] **Step 6: Commit**

```bash
git add src/pose/refinePoseDetection.ts src/pose/refinePoseDetection.test.ts
git commit -m "feat: add focused pose refinement pass"
```

---

### Task 5: Add agreement and presence to landmark reliability

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/domain/types.test.ts`
- Modify: `src/reliability/evaluateLandmarkReliability.ts`
- Modify: `src/reliability/evaluateLandmarkReliability.test.ts`
- Modify: `src/analysis/measurePose.test.ts`
- Modify: `src/annotation/buildCommands.test.ts`

**Interfaces:**
- Adds: `ReliabilityReason = 'low-presence' | 'cross-pass-disagreement'`.
- Changes compatibly: `evaluateLandmarkReliability(landmarks, view, disagreements?)` where the third argument defaults to an empty set.

- [ ] **Step 1: Write failing reliability tests**

Add:

```ts
it('rejects defined presence below 0.60 without rejecting absent presence', () => {
  const low = update(landmarkPerson(), 'left_knee', { presence: 0.59 });
  expect(evaluateLandmarkReliability(low, 'front').get('left_knee')?.reasons).toContain('low-presence');
  expect(evaluateLandmarkReliability(landmarkPerson(), 'front').get('left_knee')?.assessability).toBe('assessable');
});

it('marks a cross-pass disagreement unassessable', () => {
  const result = evaluateLandmarkReliability(
    landmarkPerson(), 'front', new Set<LandmarkName>(['left_knee']),
  );
  expect(result.get('left_knee')).toMatchObject({
    assessability: 'unassessable',
    confidence: 'low',
    reasons: expect.arrayContaining(['cross-pass-disagreement']),
  });
});
```

In measurement and annotation tests, pass `new Set(['left_knee'])` and assert `supportingKneeAngle.value === null`, no `left_knee` structural joint, and no skeleton segment touching `left_knee`.

- [ ] **Step 2: Run the focused tests and verify RED**

```bash
pnpm test -- src/reliability/evaluateLandmarkReliability.test.ts src/analysis/measurePose.test.ts src/annotation/buildCommands.test.ts
```

Expected: FAIL because presence and disagreements are not evaluated.

- [ ] **Step 3: Implement reliability reasons**

Add the optional disagreement set and these checks in the per-landmark loop:

```ts
if (point.presence !== undefined && (!Number.isFinite(point.presence) || point.presence < MIN_VISIBILITY)) {
  addReason(reasons, name, 'low-presence');
}
if (disagreements.has(name)) addReason(reasons, name, 'cross-pass-disagreement');
```

Do not change existing chain or occlusion thresholds. Existing measurement and annotation code should need no production change because both already honor the reliability map.

- [ ] **Step 4: Verify GREEN**

```bash
pnpm test -- src/reliability/evaluateLandmarkReliability.test.ts src/analysis/measurePose.test.ts src/annotation/buildCommands.test.ts
pnpm exec tsc --noEmit
```

Expected: all tests pass and existing conservative behavior remains green.

- [ ] **Step 5: Commit**

```bash
git add src/domain/types.ts src/domain/types.test.ts src/reliability/evaluateLandmarkReliability.ts src/reliability/evaluateLandmarkReliability.test.ts src/analysis/measurePose.test.ts src/annotation/buildCommands.test.ts
git commit -m "feat: suppress unstable pose evidence"
```

---

### Task 6: Split initial and refined quality decisions

**Files:**
- Modify: `src/quality/evaluateQuality.ts`
- Modify: `src/quality/evaluateQuality.test.ts`
- Modify: `src/quality/types.ts`
- Modify: `src/quality/messages.ts`

**Interfaces:**
- Adds: `QualityInput.requiredJointVisibility?: 'enforce' | 'defer'`, defaulting to `enforce`.
- Adds reason codes: `subject-too-small`, `unstable-pose-landmarks`.

- [ ] **Step 1: Write failing quality-policy and message tests**

Add:

```ts
it('defers only required-joint visibility during the whole-image pass', () => {
  const report = evaluateQuality(baseInput({
    landmarks: landmarkSet([fullPerson([landmark('left_knee', 0.35, 0.68, 0.59)])]),
    requiredJointVisibility: 'defer',
  }));
  expect(report.reasons.map((reason) => reason.code)).not.toContain('required-joints-not-visible');
});

it('still rejects out-of-frame evidence while visibility is deferred', () => {
  const report = evaluateQuality(baseInput({
    landmarks: landmarkSet([fullPerson([landmark('left_foot_index', 0.01, 0.93)])]),
    requiredJointVisibility: 'defer',
  }));
  expect(report.reasons.map((reason) => reason.code)).toContain('body-out-of-frame');
});
```

Assert exact messages:

```ts
expect(QUALITY_MESSAGES['subject-too-small']).toBe(
  'Move closer while keeping your full body, hands, and feet in the frame.',
);
expect(QUALITY_MESSAGES['unstable-pose-landmarks']).toBe(
  'Retake the photo closer, with less clothing, barre, or limb overlap around the joints.',
);
```

- [ ] **Step 2: Run and verify RED**

```bash
pnpm test -- src/quality/evaluateQuality.test.ts
```

Expected: FAIL because the policy and reason codes do not exist.

- [ ] **Step 3: Implement the quality policy and messages**

Default `requiredJointVisibility` to `enforce`. Skip only the `required-joints-not-visible` reason when it is `defer`; keep person count, frame, view, image metrics, and optional-arm coverage unchanged.

- [ ] **Step 4: Verify GREEN**

```bash
pnpm test -- src/quality/evaluateQuality.test.ts
pnpm exec tsc --noEmit
```

Expected: all quality tests and TypeScript pass.

- [ ] **Step 5: Commit**

```bash
git add src/quality/evaluateQuality.ts src/quality/evaluateQuality.test.ts src/quality/types.ts src/quality/messages.ts
git commit -m "feat: defer joint visibility until refinement"
```

---

### Task 7: Integrate two-pass detection into the analysis pipeline

**Files:**
- Modify: `src/pipeline/analyzePose.ts`
- Modify: `src/pipeline/analyzePose.test.ts`
- Modify: `src/app/App.test.tsx`

**Interfaces:**
- Adds to `AnalysisServices`: `refine?: typeof refinePoseDetection`.
- Passes `disagreements` to `evaluateLandmarkReliability`.
- Preserves all `AnalysisOutcome` shapes.

- [ ] **Step 1: Update the pipeline test fixture with a stable refinement seam**

In `servicesThatRecord`, add:

```ts
refine: vi.fn<NonNullable<AnalysisServices['refine']>>(async () => {
  calls.push('refine');
  return {
    status: 'success',
    landmarks: { people: [landmarks], sourceWidth: decoded.width, sourceHeight: decoded.height },
    disagreements: new Set(),
  };
}),
```

Define the same stable refinement as a small test helper and inject it into every direct pipeline service object whose test proceeds beyond initial quality. Tests that intentionally stop on decode failure or initial-quality failure do not need the helper. This prevents unit tests from creating real canvases while preserving a dedicated coordinator test in Task 4.

Update the expected successful call order to:

```ts
['metrics', 'detect', 'quality', 'refine', 'quality', 'reliability', 'measure', 'evaluate', 'deduplicate', 'feedback', 'annotations']
```

Assert the first quality call receives `requiredJointVisibility: 'defer'`, the second receives `enforce`, and reliability receives the disagreement set.

- [ ] **Step 2: Run the principal pipeline test and verify RED**

```bash
pnpm test -- src/pipeline/analyzePose.test.ts -t "passes one normalised source"
```

Expected: FAIL because `refine` is not part of the pipeline.

- [ ] **Step 3: Implement the successful orchestration path**

After whole-image detection:

```ts
const initialQuality = quality({
  landmarks: wholeLandmarks,
  position: request.position,
  supportingSide: request.supportingSide,
  expectedView: request.expectedView,
  metrics: pixelMetrics,
  requiredJointVisibility: 'defer',
});
```

Return early if initial quality fails. Then invoke `services.refine ?? refinePoseDetection`. On success, run quality again against refined landmarks with `requiredJointVisibility: 'enforce'`, use the refined person everywhere downstream, and call:

```ts
const reliability = reliabilityFor(
  landmarks,
  request.expectedView,
  refined.disagreements,
);
```

Merge initial optional-region coverage, refined quality coverage, and viability coverage without duplicates.

- [ ] **Step 4: Add failing retake outcome tests**

Add one test per refinement outcome:

```ts
it.each([
  ['subject-too-small', 'subject-too-small'],
  ['unstable-pose-landmarks', 'unstable-pose-landmarks'],
  ['insufficient-pose-evidence', 'insufficient-pose-evidence'],
] as const)('returns %s before rules', async (status, code) => {
  services.refine.mockResolvedValue({ status });
  const outcome = await analyzePose(request, services);
  expect(outcome).toMatchObject({ status: 'retake', quality: { reasons: [{ code }] } });
  expect(services.evaluate).not.toHaveBeenCalled();
  expect(decoded.dispose).toHaveBeenCalledOnce();
});
```

Add a test where `disagreements` contains the supporting knee and working hip. Assert no knee/pelvis corrections or annotation commands can be produced. Add another where only an arm disagrees and the result remains partial/successful.

- [ ] **Step 5: Make viability choose the correct retake reason**

When viability fails after refinement, use `unstable-pose-landmarks` if `disagreements.size > 0`; otherwise retain `insufficient-pose-evidence`. Preserve `imageWasResized` and `unassessableRegions`.

- [ ] **Step 6: Update App unit-test services**

Add a shared test helper returning stable refined landmarks:

```ts
const stableRefine = async ({ whole }: RefinePoseInput): Promise<RefinedPoseOutcome> => ({
  status: 'success',
  landmarks: whole,
  disagreements: new Set(),
});
```

Inject it through `services.analysis.refine` in App tests that reach successful analysis. Leave decode-failure and pending-first-detection cancellation tests unchanged when refinement is never reached. For cancellation after the first detection resolves, add a refinement deferred promise and assert a stale refinement result is disposed/ignored under the existing generation guard.

- [ ] **Step 7: Run pipeline and App tests and verify GREEN**

```bash
pnpm test -- src/pipeline/analyzePose.test.ts src/app/App.test.tsx
pnpm exec tsc --noEmit
```

Expected: all tests pass, successful calls use refined landmarks, and every retake disposes the decoded image.

- [ ] **Step 8: Commit**

```bash
git add src/pipeline/analyzePose.ts src/pipeline/analyzePose.test.ts src/app/App.test.tsx
git commit -m "feat: integrate refined pose analysis"
```

---

### Task 8: Clarify partial-result copy and preserve the mobile/privacy flow

**Files:**
- Modify: `src/feedback/composeFeedback.ts`
- Modify: `src/feedback/composeFeedback.test.ts`
- Modify: `src/ui/CheckCard.tsx`
- Modify: `src/ui/CheckCard.test.tsx`
- Modify: `tests/e2e/mobile-flow.spec.ts`

**Interfaces:**
- No new public interfaces.
- User-facing copy must not mention model names, confidence values, thresholds, passes, or internal detector terms.

- [ ] **Step 1: Write failing copy tests**

Update/add assertions for:

```ts
expect(unassessableSection.items[0]?.text).toBe(
  'Unable to assess this area reliably because the joint may be obscured or inconsistent.',
);
```

For a partial `CheckCard`, assert this note appears once before the regional list:

```text
Some areas were not assessed because their joint positions were obscured or inconsistent.
```

- [ ] **Step 2: Run and verify RED**

```bash
pnpm test -- src/feedback/composeFeedback.test.ts src/ui/CheckCard.test.tsx
```

Expected: FAIL on the old generic copy.

- [ ] **Step 3: Implement the approved copy**

Change only the unassessable-region sentence in `composeFeedback.ts`. In `CheckCard.tsx`, render the partial-assessment note once and keep the existing region-specific list and enabled Analyse button.

- [ ] **Step 4: Update the E2E test service and privacy assertions**

Add a stable `analysis.refine` fake returning the same synthetic landmarks and an empty disagreement set. Keep the existing checks for zero localStorage writes, zero IndexedDB opens, and zero POST requests. Add an assertion that the analysing status remains visible while a deferred refinement promise is pending, then resolves to the check card.

- [ ] **Step 5: Verify GREEN at mobile viewports**

```bash
pnpm test -- src/feedback/composeFeedback.test.ts src/ui/CheckCard.test.tsx
pnpm test:e2e -- --project=chromium-phone
pnpm test:e2e -- --project=mobile-safari
```

Expected: unit and both mobile browser projects pass; the privacy counters remain `{ localStorage: 0, indexedDB: 0, posts: 0 }`.

- [ ] **Step 6: Commit**

```bash
git add src/feedback/composeFeedback.ts src/feedback/composeFeedback.test.ts src/ui/CheckCard.tsx src/ui/CheckCard.test.tsx tests/e2e/mobile-flow.spec.ts
git commit -m "feat: explain conservative partial pose results"
```

---

### Task 9: Full regression, model asset, and manual acceptance

**Files:**
- Verify: all files changed in Tasks 1–8
- Generated locally and ignored: `public/models/pose_landmarker_heavy.task`

**Interfaces:**
- No code interfaces; this task proves the accepted specification.

- [ ] **Step 1: Synchronize the Heavy asset**

```bash
pnpm sync:assets
test -s public/models/pose_landmarker_heavy.task
```

Expected: both commands exit `0`; the Heavy model exists and is non-empty. Confirm `public/models/pose_landmarker_lite.task` is not referenced by source or scripts:

```bash
rg -n "pose_landmarker_lite" src scripts package.json
```

Expected: no matches.

- [ ] **Step 2: Run the complete automated suite**

```bash
pnpm test
pnpm build
pnpm test:e2e
```

Expected: every command exits `0`, with zero failed tests, zero TypeScript errors, and a successful production bundle.

- [ ] **Step 3: Audit the implementation against every acceptance criterion**

```bash
rg -n "pose_landmarker_heavy|MIN_TORSO_PIXELS|MIN_BODY_EXTENT_PIXELS|FOCUS_PADDING_RATIO|MAJOR_JOINT_AGREEMENT|FLEXIBLE_JOINT_AGREEMENT|cross-pass-disagreement|subject-too-small|unstable-pose-landmarks" src scripts
```

Expected: each specification constant/reason is present in its owning module and covered by a named test. Inspect `git diff --check` and `git status --short`; there must be no user photos, screenshots, generated model files, or unrelated changes staged.

- [ ] **Step 4: Manually verify two privacy-safe local photos**

Run the production preview:

```bash
pnpm exec vite preview --host 127.0.0.1 --port 4173
```

At a 390×844 viewport, verify:

1. A landscape full-body photo with a relatively small dancer completes the focused analysis without cropping hands or feet.
2. A portrait photo with a tutu or barre crossing the hip area either suppresses the unstable hip/leg region or requests a retake; it must not claim a knee is bent from an unstable knee.
3. Stable structural landmarks align with the original displayed image.
4. Partial regions show the approved conservative copy.
5. DevTools Network shows only local static/model GET requests and no photo POST/upload request.

Do not add either photo to the repository. If no suitable privacy-safe sample exists, record the manual-photo step as not executed rather than substituting a screenshot of the web result.

- [ ] **Step 5: Run fresh final verification after any manual-test fixes**

```bash
pnpm test && pnpm build && pnpm test:e2e
```

Expected: exit `0`; report exact test file/test counts from the fresh output before claiming completion.

- [ ] **Step 6: Commit final verification-only adjustments, if any**

If Step 4 required code or test changes, repeat their Red-Green cycle first, then:

```bash
git add src tests scripts
git commit -m "fix: close refined pose acceptance gaps"
```

If no files changed, do not create an empty commit.

---

## Execution Notes

- The current workspace allows editing project files but may reject Git index writes. If `git commit` fails with an `index.lock` permission error, keep the tested file changes intact, report the exact blocker, and do not bypass the sandbox through UI automation or alternate Git metadata.
- The Heavy model is ignored by Git through `public/models/`; the synchronization script is the reproducible source. Verify the deploy/build environment can fetch the official Google asset before publishing.
- The two user screenshots demonstrate symptoms but are not valid inference fixtures because they contain the rendered result page, not the original uploaded pixels or detector confidence data.
- Publishing is a separate, user-approved action after this plan completes.

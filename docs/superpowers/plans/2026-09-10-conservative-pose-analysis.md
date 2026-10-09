# Conservative Pose Analysis Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make ALIGNÉ resize high-pixel photos safely, assess pose evidence conservatively, show the full reliable structural skeleton, and suppress unsupported ballet corrections.

**Architecture:** Normalise every accepted upload into one analysis coordinate space, then insert a landmark-reliability boundary between pose detection and measurement. Measurements carry value, confidence, assessability, and evidence into a view-aware rule engine; feedback and drawing commands consume only supported observations. Existing React cards remain the user-facing flow, with a resize notice added to Check and conservative uncertainty copy added to Result.

**Tech Stack:** React 19, TypeScript 7, Vite 8, Vitest 4, Testing Library, Playwright, Canvas 2D, MediaPipe Tasks Vision.

**Spec:** `docs/superpowers/specs/2026-09-10-conservative-pose-analysis-design.md`

## Global Constraints

- Reject images whose shortest decoded side is below 480 pixels; never upscale them.
- Resize an image whose longest decoded side exceeds 4096 pixels to a 4096-pixel longest side while preserving aspect ratio and orientation.
- Keep the existing 12 MiB file-size safety limit.
- Use the normalised image for metrics, detection, annotation, preview, and download so every downstream stage shares one coordinate space.
- Interpret the selected supporting side as the dancer's own left or right side.
- Only high-confidence, clearly out-of-tolerance observations may enter Top 3; returning fewer than three is valid.
- Supporting-knee thresholds are `<165°` clear bend, `165°..<175°` tolerance, and `>=175°` visually straight.
- Do not infer fore-aft hip placement, true centre of mass, or three-dimensional rotation from one photo.
- Draw only reliable structural landmarks and connections; numbered markers map one-to-one to displayed corrections.
- Keep all user-facing feedback in English and free of medical or numeric language.
- Do not store or commit the user's original photograph; regression coverage uses derived or synthetic landmark data only.

---

## Planned File Structure

**Create**

- `src/image/normaliseImage.ts` — turn one decoded source into the bounded analysis image and expose resize metadata.
- `src/image/normaliseImage.test.ts` — verify minimum dimensions, proportional resize, cleanup, and canvas failures.
- `src/reliability/evaluateLandmarkReliability.ts` — evaluate visibility, coordinates, crop, overlap, and limb-chain plausibility.
- `src/reliability/evaluateLandmarkReliability.test.ts` — verify reliable, occluded, displaced, and mirrored landmark cases.
- `src/rules/deduplicateObservations.ts` — collapse observations that represent the same evidence group.
- `src/rules/deduplicateObservations.test.ts` — verify deterministic duplicate selection.
- `tests/fixtures/retire-front-straight-support.ts` — derived landmark-only reproduction of the reported false bent-knee case.

**Modify**

- `src/domain/types.ts` — add normalisation, landmark-reliability, measurement-evidence, and neutral-joint drawing types.
- `src/image/decodeImage.ts` and `src/image/decodeImage.test.ts` — decode raw sources, reject only undersized images, then delegate to normalisation.
- `src/quality/types.ts`, `src/quality/messages.ts`, and quality tests — carry resize state and an actionable normalisation-failure reason.
- `src/analysis/measurePose.ts` and `src/analysis/measurePose.test.ts` — return structured measurements rather than nullable numbers.
- `src/rules/types.ts`, `src/rules/evaluateRules.ts`, and their tests — require assessable evidence, enforce view constraints, and propagate conservative confidence.
- `src/rules/commonRules.ts`, `src/rules/retireRules.ts`, all position-rule tests, and fixture expectations — apply new thresholds and remove duplicate/unsupported stacking claims.
- `src/feedback/copy.ts`, `src/feedback/composeFeedback.ts`, and their tests — include only high-confidence findings and use evidence-insufficient copy elsewhere.
- `src/annotation/buildCommands.ts`, `src/annotation/drawAnnotatedPose.ts`, and their tests — add neutral main-joint dots, head dots, heel connections, and reliability filtering.
- `src/pipeline/analyzePose.ts` and `src/pipeline/analyzePose.test.ts` — wire normalisation, reliability, structured measurements, de-duplication, feedback, and annotation in order.
- `src/ui/CheckCard.tsx`, `src/ui/CheckCard.test.tsx`, `src/ui/ResultCard.tsx`, and `src/ui/ResultCard.test.tsx` — show resize and insufficient-evidence states without adding a stage.
- `src/app/App.test.tsx`, `src/app/e2eServices.ts`, and `tests/e2e/mobile-flow.spec.ts` — update test doubles and verify the unchanged single-card mobile journey.

---

### Task 1: Bounded Analysis Image

**Files:**

- Create: `src/image/normaliseImage.ts`
- Create: `src/image/normaliseImage.test.ts`
- Modify: `src/image/decodeImage.ts:3-76`
- Modify: `src/image/decodeImage.test.ts:1-66`
- Modify: `src/domain/types.ts:1-40`
- Modify: `src/quality/types.ts:3-28`
- Modify: `src/quality/messages.ts:3-16`

**Interfaces:**

- Consumes: a decoded `ImageBitmap | HTMLImageElement` plus a cleanup callback.
- Produces: `normaliseImage(source, releaseSource, canvasFactory?): DecodedImage`, where `DecodedImage` has `source`, `width`, `height`, `normalisation`, and idempotent `dispose()`.

- [ ] **Step 1: Add failing normalisation tests**

```ts
function resizeCanvasWithContext(): HTMLCanvasElement {
  return {
    width: 0,
    height: 0,
    getContext: () => ({ drawImage: vi.fn() }),
  } as unknown as HTMLCanvasElement;
}

it('resizes an 8000×4000 bitmap to 4096×2048 and preserves metadata', () => {
  const drawImage = vi.fn();
  const canvas = { width: 0, height: 0, getContext: () => ({ drawImage }) } as unknown as HTMLCanvasElement;
  const release = vi.fn();

  const result = normaliseImage(
    { width: 8000, height: 4000 } as ImageBitmap,
    release,
    () => canvas,
  );

  expect(result).toMatchObject({
    source: canvas,
    width: 4096,
    height: 2048,
    normalisation: { wasResized: true, originalWidth: 8000, originalHeight: 4000 },
  });
  expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 4096, 2048);
});

it('rejects a shortest side below 480 without creating a canvas', () => {
  let failure: unknown;
  try {
    normaliseImage({ width: 479, height: 960 } as ImageBitmap, vi.fn(), vi.fn());
  } catch (error) {
    failure = error;
  }
  expect(failure).toEqual({ code: 'image-too-small' });
});

it('returns an actionable code when the resize canvas is unavailable', () => {
  let failure: unknown;
  try {
    normaliseImage(
      { width: 9000, height: 6000 } as ImageBitmap,
      vi.fn(),
      () => ({ getContext: () => null } as unknown as HTMLCanvasElement),
    );
  } catch (error) {
    failure = error;
  }
  expect(failure).toEqual({ code: 'normalisation-failed' });
});
```

- [ ] **Step 2: Run the new tests and verify the missing module fails**

Run: `pnpm test -- src/image/normaliseImage.test.ts`

Expected: FAIL because `./normaliseImage` does not exist.

- [ ] **Step 3: Define normalisation metadata and implement the bounded canvas source**

Add to `src/domain/types.ts`:

```ts
export interface ImageNormalisation {
  wasResized: boolean;
  originalWidth: number;
  originalHeight: number;
}
```

Implement `src/image/normaliseImage.ts` around these exact constants and result shape:

```ts
export const MIN_IMAGE_SIDE = 480;
export const MAX_ANALYSIS_SIDE = 4096;

export interface DecodedImage {
  source: ImageBitmap | HTMLImageElement | HTMLCanvasElement;
  width: number;
  height: number;
  normalisation: ImageNormalisation;
  dispose(): void;
}

export function normaliseImage(
  source: ImageBitmap | HTMLImageElement,
  releaseSource: () => void,
  canvasFactory = () => document.createElement('canvas'),
): DecodedImage {
  const originalWidth = 'naturalWidth' in source ? source.naturalWidth : source.width;
  const originalHeight = 'naturalHeight' in source ? source.naturalHeight : source.height;
  if (Math.min(originalWidth, originalHeight) < MIN_IMAGE_SIDE) {
    releaseSource();
    throw { code: 'image-too-small' };
  }
  const scale = Math.min(1, MAX_ANALYSIS_SIDE / Math.max(originalWidth, originalHeight));
  const width = Math.round(originalWidth * scale);
  const height = Math.round(originalHeight * scale);
  if (scale === 1) return disposableSource(source, width, height, releaseSource, false, originalWidth, originalHeight);

  const canvas = canvasFactory();
  try {
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas context unavailable');
    context.drawImage(source, 0, 0, width, height);
  } catch {
    releaseSource();
    throw { code: 'normalisation-failed' };
  }
  releaseSource();
  return disposableCanvas(canvas, width, height, originalWidth, originalHeight);
}
```

Define the two private helpers with these signatures:

```ts
function disposableSource(
  source: ImageBitmap | HTMLImageElement,
  width: number,
  height: number,
  releaseSource: () => void,
  wasResized: false,
  originalWidth: number,
  originalHeight: number,
): DecodedImage;

function disposableCanvas(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  originalWidth: number,
  originalHeight: number,
): DecodedImage;
```

Both guard cleanup with a boolean so repeated `dispose()` calls do nothing. A resized canvas is cleared by setting `width = 0` and `height = 0`; the original bitmap or image element is released immediately after drawing.

- [ ] **Step 4: Route both bitmap and image-element decoding through `normaliseImage`**

Remove the 8192-pixel rejection. `decodeImage(file)` continues using `createImageBitmap(file, { imageOrientation: 'from-image' })`, falling back to an `HTMLImageElement`, then calls `normaliseImage` in both branches. Treat `image-too-small` and `normalisation-failed` as terminal structured failures rather than reasons to retry the other decoder. Re-export `DecodedImage` from `decodeImage.ts` so current consumers keep their import path. Add `'normalisation-failed'` to `ImageErrorCode` and `QualityReasonCode`, with this copy:

```ts
'normalisation-failed': 'This photo could not be resized on this device. Try a smaller export or retake the photo.',
```

Delete the obsolete user-facing `image-too-large` message; large dimensions are no longer a retake condition.

- [ ] **Step 5: Update decode tests and run the image suite**

Replace the old “rejects above 8192” expectation with:

```ts
it('automatically resizes a bitmap above the analysis limit', async () => {
  const bitmap = { width: 8193, height: 4096, close: vi.fn() } as unknown as ImageBitmap;
  vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(bitmap));
  vi.spyOn(document, 'createElement').mockReturnValue(resizeCanvasWithContext());

  const decoded = await decodeImage(file);

  expect(decoded.width).toBe(4096);
  expect(decoded.normalisation.wasResized).toBe(true);
});
```

Run: `pnpm test -- src/image/decodeImage.test.ts src/image/normaliseImage.test.ts src/image/validateImageFile.test.ts`

Expected: PASS, including the unchanged 12 MiB validation tests.

- [ ] **Step 6: Commit the image boundary**

```bash
git add src/domain/types.ts src/image/decodeImage.ts src/image/decodeImage.test.ts src/image/normaliseImage.ts src/image/normaliseImage.test.ts src/quality/types.ts src/quality/messages.ts
git commit -m "feat: normalise large pose images"
```

---

### Task 2: Landmark Reliability Gate

**Files:**

- Create: `src/reliability/evaluateLandmarkReliability.ts`
- Create: `src/reliability/evaluateLandmarkReliability.test.ts`
- Modify: `src/domain/types.ts:12-28`
- Modify: `tests/builders/landmarks.ts:1-35`

**Interfaces:**

- Consumes: `evaluateLandmarkReliability(landmarks: readonly Landmark[], view: ViewType): LandmarkReliabilityMap`.
- Produces: a map keyed by `LandmarkName`; each entry has `confidence`, `assessability`, and concrete `reasons`.

- [ ] **Step 1: Write failing tests for visibility, overlap, geometry, and mirroring**

```ts
function overlapPair(
  person: readonly Landmark[],
  first: LandmarkName,
  second: LandmarkName,
): readonly Landmark[] {
  const target = person.find((point) => point.name === second)!;
  return person.map((point) => point.name === first
    ? { ...point, x: target.x, y: target.y }
    : point);
}

it('marks a visible plausible supporting chain assessable', () => {
  const result = evaluateLandmarkReliability(landmarkPerson(), 'front');
  expect(result.get('left_knee')).toMatchObject({ assessability: 'assessable', confidence: 'high', reasons: [] });
});

it('rejects a high-visibility knee whose leg-chain proportions are implausible', () => {
  const displaced = landmarkPerson().map((point) => point.name === 'left_knee'
    ? { ...point, x: 0.95, visibility: 0.99 }
    : point);
  expect(evaluateLandmarkReliability(displaced, 'front').get('left_knee')).toMatchObject({
    assessability: 'unassessable',
    reasons: expect.arrayContaining(['implausible-chain']),
  });
});

it('marks overlapping same-joint sides ambiguous without changing unrelated joints', () => {
  const overlapped = overlapPair(landmarkPerson(), 'left_wrist', 'right_wrist');
  const result = evaluateLandmarkReliability(overlapped, 'three-quarter-side');
  expect(result.get('left_wrist')?.reasons).toContain('possible-occlusion');
  expect(result.get('left_hip')?.assessability).toBe('assessable');
});

it('returns the same semantic reliability after left-right mirroring', () => {
  const left = evaluateLandmarkReliability(landmarkPerson(), 'front');
  const right = evaluateLandmarkReliability(mirroredPerson(landmarkPerson()), 'front');
  expect(right.get('right_knee')?.assessability).toBe(left.get('left_knee')?.assessability);
});
```

- [ ] **Step 2: Run reliability tests and verify they fail**

Run: `pnpm test -- src/reliability/evaluateLandmarkReliability.test.ts`

Expected: FAIL because the reliability module and types do not exist.

- [ ] **Step 3: Add explicit reliability types**

Add to `src/domain/types.ts`:

```ts
export type ReliabilityReason =
  | 'missing'
  | 'non-finite'
  | 'low-visibility'
  | 'outside-frame'
  | 'implausible-chain'
  | 'possible-occlusion';

export interface LandmarkReliability {
  name: LandmarkName;
  confidence: Confidence;
  assessability: Assessability;
  reasons: readonly ReliabilityReason[];
}

export type LandmarkReliabilityMap = ReadonlyMap<LandmarkName, LandmarkReliability>;
```

- [ ] **Step 4: Implement conservative landmark assessment**

Use these named constants in `evaluateLandmarkReliability.ts`:

```ts
const MIN_VISIBILITY = 0.60;
const HIGH_VISIBILITY = 0.80;
const FRAME_MARGIN = 0.02;
const MIN_ADJACENT_SEGMENT_RATIO = 0.35;
const MAX_ADJACENT_SEGMENT_RATIO = 2.85;
const OCCLUSION_DISTANCE_IN_TORSOS = 0.08;
```

Build chains for shoulder-elbow-wrist and hip-knee-ankle on each side. A point is unassessable if missing, non-finite, below `MIN_VISIBILITY`, outside the frame margin, or if the two segments around a middle joint have a length ratio outside `0.35..2.85`. Mark same-type left/right elbows, wrists, knees, ankles, heels, or toe points within `0.08 × torsoLength` with `possible-occlusion`; keep shoulder and hip pairs exempt because close projected pairs are expected in three-quarter views. Do not reject a point merely because left/right horizontal ordering changes.

Confidence is `high` only when visibility is at least `0.80` and no reliability reason is present. A point with visibility from `0.60` to below `0.80` remains assessable with `medium` confidence. Any reliability reason makes it unassessable with `low` confidence.

- [ ] **Step 5: Run reliability and builder tests**

Run: `pnpm test -- src/reliability/evaluateLandmarkReliability.test.ts src/analysis/measurePose.test.ts src/pose/MediaPipePoseDetector.test.ts`

Expected: PASS with MediaPipe mapping unchanged.

- [ ] **Step 6: Commit the reliability boundary**

```bash
git add src/domain/types.ts src/reliability tests/builders/landmarks.ts
git commit -m "feat: assess pose landmark reliability"
```

---

### Task 3: Evidence-Carrying Measurements

**Files:**

- Modify: `src/analysis/measurePose.ts:1-92`
- Modify: `src/analysis/measurePose.test.ts:1-62`
- Modify: `src/rules/types.ts:1-22`
- Modify: `src/domain/types.ts:12-45`

**Interfaces:**

- Consumes: `measurePose(landmarks, supportingSide, reliability, view)`.
- Produces: `MeasurementSet`, where every field is a `PoseMeasurement` and no rule reads a bare nullable number.

- [ ] **Step 1: Write failing tests for structured results**

```ts
it('returns value, evidence, confidence, and assessability for a reliable knee', () => {
  const landmarks = landmarkPerson();
  const reliability = evaluateLandmarkReliability(landmarks, 'front');
  const measurements = measurePose(landmarks, 'left', reliability, 'front');

  expect(measurements.supportingKneeAngle).toMatchObject({
    value: expect.any(Number),
    assessability: 'assessable',
    confidence: 'high',
    evidence: ['left_hip', 'left_knee', 'left_ankle'],
  });
});

it('withholds a number when one evidence landmark is unreliable', () => {
  const landmarks = landmarkPerson().map((point) => point.name === 'left_knee'
    ? { ...point, x: 0.95, visibility: 0.99 }
    : point);
  const measurements = measurePose(
    landmarks,
    'left',
    evaluateLandmarkReliability(landmarks, 'front'),
    'front',
  );
  expect(measurements.supportingKneeAngle).toMatchObject({ value: null, assessability: 'unassessable' });
});

it('marks frontal-only support offset unassessable in a three-quarter view', () => {
  const landmarks = landmarkPerson();
  const measurements = measurePose(landmarks, 'left', evaluateLandmarkReliability(landmarks, 'three-quarter-side'), 'three-quarter-side');
  expect(measurements.frontalSupportingHipAnkleOffset).toMatchObject({ value: null, assessability: 'unassessable', reason: 'unsupported-view' });
});
```

- [ ] **Step 2: Run measurement tests and verify the old numeric API fails**

Run: `pnpm test -- src/analysis/measurePose.test.ts`

Expected: FAIL because `MeasurementSet` still exposes nullable numbers.

- [ ] **Step 3: Define `PoseMeasurement` and migrate `MeasurementSet`**

```ts
export interface PoseMeasurement {
  value: number | null;
  confidence: Confidence;
  assessability: Assessability;
  evidence: readonly LandmarkName[];
  reason?: ReliabilityReason | 'missing-geometry' | 'unsupported-view';
}

export interface MeasurementSet {
  torsoLength: PoseMeasurement;
  supportingKneeAngle: PoseMeasurement;
  workingKneeAngle: PoseMeasurement;
  pelvisSlope: PoseMeasurement;
  shoulderSlope: PoseMeasurement;
  torsoLateralOffset: PoseMeasurement;
  workingAnkleToSupportingKnee: PoseMeasurement;
  workingKneeLateralOffset: PoseMeasurement;
  workingKneeHeightFromHip: PoseMeasurement;
  workingAnkleHeightFromHip: PoseMeasurement;
  frontalSupportingHipAnkleOffset: PoseMeasurement;
  leftElbowAngle: PoseMeasurement;
  rightElbowAngle: PoseMeasurement;
  headTiltFromTorso: PoseMeasurement;
}
```

Rename `supportingAnkleUnderHipOffset` to `frontalSupportingHipAnkleOffset`. A measurement helper accepts its evidence names, refuses computation if any evidence entry is unassessable, and sets confidence to the lowest evidence confidence. Every body-normalised measurement also depends on an assessable `torsoLength`; if the torso basis is unavailable, return `missing-geometry` instead of a number. The view argument sets `unsupported-view` before calculating a frontal-only measurement.

- [ ] **Step 4: Preserve dancer-side mirroring and non-finite protection**

Update all existing measurement assertions to use `.value`. Add exact mirrored checks for the selected supporting knee, working knee, and frontal support offset. Non-finite source coordinates must return `{ value: null, assessability: 'unassessable' }`, never `NaN` or `Infinity`.

- [ ] **Step 5: Run analysis tests**

Run: `pnpm test -- src/analysis/geometry.test.ts src/analysis/measurePose.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit structured measurements**

```bash
git add src/domain/types.ts src/analysis/measurePose.ts src/analysis/measurePose.test.ts src/rules/types.ts
git commit -m "refactor: carry evidence through pose measurements"
```

---

### Task 4: Conservative Rules, View Limits, and De-duplication

**Files:**

- Create: `src/rules/deduplicateObservations.ts`
- Create: `src/rules/deduplicateObservations.test.ts`
- Modify: `src/domain/types.ts:28-68`
- Modify: `src/rules/types.ts:1-22`
- Modify: `src/rules/evaluateRules.ts:1-58`
- Modify: `src/rules/commonRules.ts:1-85`
- Modify: `src/rules/retireRules.ts:1-35`
- Modify: `src/rules/arabesqueRules.ts`
- Modify: `src/rules/attitudeRules.ts`
- Modify: `src/rules/*.test.ts`
- Modify: `tests/fixtures/*.json`
- Modify: `src/feedback/copy.ts:1-54`
- Modify: `src/feedback/composeFeedback.ts:1-71`
- Modify: `src/feedback/composeFeedback.test.ts:1-170`

**Interfaces:**

- Consumes: rules whose `requiredMeasurements` point to `PoseMeasurement` objects.
- Produces: view-supported observations with `dedupeKey`; `deduplicateObservations(observations)` returns one deterministic observation per key before feedback composition. `RuleContext` contains `reliability: LandmarkReliabilityMap` so rule confidence never falls back to raw visibility alone.

- [ ] **Step 1: Write failing conservative-threshold and view-limit tests**

```ts
function contextWithMeasurement(
  key: keyof MeasurementSet,
  value: number,
  confidence: Confidence = 'high',
): RuleContext {
  const base = context();
  return {
    ...base,
    measurements: {
      ...base.measurements,
      [key]: {
        ...base.measurements[key],
        value,
        confidence,
        assessability: 'assessable',
      },
    },
  };
}

it.each([
  [164.99, true],
  [165, false],
  [170, false],
  [174.99, false],
  [175, false],
])('treats supporting-knee angle %s conservatively', (angle, expected) => {
  const observations = evaluateRules(COMMON_RULES, contextWithMeasurement('supportingKneeAngle', angle));
  expect(observations.some((item) => item.ruleId === 'supporting-knee-bent')).toBe(expected);
});

it('does not evaluate frontal support alignment from a three-quarter-side view', () => {
  const observations = evaluateRules(COMMON_RULES, context({ view: 'three-quarter-side' }));
  expect(observations.find((item) => item.ruleId === 'supporting-lateral-offset')).toMatchObject({ assessability: 'unassessable' });
});

it('withholds a rule when its measurement is only medium confidence', () => {
  const observations = evaluateRules(COMMON_RULES, contextWithMeasurement('pelvisSlope', 12, 'medium'));
  expect(composeFeedback(observations, allRegionsAssessable).topCorrections).toEqual([]);
});
```

- [ ] **Step 2: Write failing de-duplication tests**

```ts
function finding(
  overrides: Partial<Extract<Observation, { assessability: 'assessable' }>>,
): Observation {
  return {
    id: 'finding',
    ruleId: 'pelvis-unlevel',
    dedupeKey: 'pelvis-level',
    region: 'pelvis',
    priority: 'structure',
    confidence: 'high',
    evidence: ['left_hip', 'right_hip'],
    annotation: [],
    assessability: 'assessable',
    issue: 'Visible issue.',
    action: 'Correct it.',
    direction: 'level the visible pelvis line',
    severity: 0.5,
    ...overrides,
  };
}

it('keeps one deterministic correction for observations sharing a dedupe key', () => {
  const result = deduplicateObservations([
    finding({ id: 'position', dedupeKey: 'pelvis-level', priority: 'structure', severity: 0.4 }),
    finding({ id: 'common', dedupeKey: 'pelvis-level', priority: 'structure', severity: 0.8 }),
  ]);
  expect(result.map((item) => item.id)).toEqual(['common']);
});
```

- [ ] **Step 3: Run rule and feedback tests and verify migration failures**

Run: `pnpm test -- src/rules src/feedback/composeFeedback.test.ts`

Expected: FAIL against the old numeric rule API, 172-degree threshold, duplicate rules, and medium-confidence inclusion.

- [ ] **Step 4: Make the evaluator consume assessable measurements**

Add `dedupeKey: string` to `ObservationBase` and `Rule`, and add `reliability: LandmarkReliabilityMap` to `RuleContext`. Update every rule-test context constructor to provide `evaluateLandmarkReliability(landmarks, view)`. In `evaluateRules`, a required measurement is usable only when:

```ts
measurement.assessability === 'assessable'
  && measurement.value !== null
  && Number.isFinite(measurement.value)
```

If not usable, return one unassessable observation for that rule. Normalised observation confidence is the lowest confidence among its required measurements and explicit evidence landmarks. Rules continue clamping severity to `0..1`.

- [ ] **Step 5: Apply the conservative knee threshold and camera-view wording**

Change `supporting-knee-bent` to trigger only below `165`. Replace `supporting-ankle-not-stacked` with `supporting-lateral-offset`; it consumes `frontalSupportingHipAnkleOffset`, declares `dedupeKey: 'supporting-lateral-alignment'`, and evaluates only the front view.

Remove `retire-stack-over-support` because it duplicates the common frontal measurement. Remove `retire-keep-pelvis-level` because it duplicates `pelvis-unlevel`; keep the common rule with `dedupeKey: 'pelvis-level'` and view-aware copy. Remove both retired IDs from `retire-acceptable.json` and `retire-common-errors.json` expectations, and use the surviving common IDs in combined-rule tests.

Use this approved copy:

```ts
'pelvis-unlevel': {
  high: 'From this view, level the visible line of your pelvis.',
  medium: 'From this view, your pelvis may appear uneven.',
},
'supporting-lateral-offset': {
  high: 'From this front view, bring your supporting hip and ankle into closer side-to-side alignment.',
  medium: 'There is not enough evidence to confirm your side-to-side support alignment.',
},
'retire-open-working-knee': {
  high: 'From this front view, move your visible working knee slightly farther to the side.',
  medium: 'From this front view, your working knee may appear close to the standing side.',
},
```

The pelvis and frontal-support copy may not say “directly over your ankle,” “centre of mass,” “forward,” or “backward.” Remove copy entries for the two retired Retiré rule IDs.

- [ ] **Step 6: Implement deterministic observation de-duplication**

`deduplicateObservations` groups by `dedupeKey`. Prefer assessable over unassessable, then high over medium over low confidence, then lower priority-order number (`stability`, `structure`, `line`), then greater severity, then lexical `ruleId`. Preserve the winning observations in their original relative order so subsequent feedback sorting remains stable.

- [ ] **Step 7: Make feedback high-confidence only and correct uncertainty states**

Change `isActionable` to accept only assessable, high-confidence observations. If a region has any unassessable rule or any withheld medium/low finding and no high-confidence finding, render:

```ts
const INSUFFICIENT_EVIDENCE_TEXT = 'Not enough evidence in this photo to recommend a change.';
```

Do not label that region “clear.” Keep “No visible issue found in this view.” only when all evaluated regional rules are assessable and produced no finding.

- [ ] **Step 8: Run every rule, fixture, copy, and agreement test**

Run: `pnpm test -- src/rules src/feedback evaluation/scoreAgreement.test.ts`

Expected: PASS after fixture expectations are updated deliberately. If the agreement score changes, record the before/after values in the commit message body; do not weaken conservative filters merely to preserve the old score.

- [ ] **Step 9: Commit the conservative rules**

```bash
git add src/domain/types.ts src/rules src/feedback tests/fixtures evaluation
git commit -m "fix: make ballet feedback evidence conservative"
```

---

### Task 5: Complete Reliable Structural Overlay

**Files:**

- Modify: `src/domain/types.ts:45-55`
- Modify: `src/annotation/buildCommands.ts:1-65`
- Modify: `src/annotation/buildCommands.test.ts:1-64`
- Modify: `src/annotation/drawAnnotatedPose.ts:1-105`
- Modify: `src/annotation/drawAnnotatedPose.test.ts:1-48`

**Interfaces:**

- Consumes: `buildAnnotationCommands(observations, landmarks, reliability, supportingSide)`.
- Produces: neutral `structural-joint` and `skeleton-segment` commands plus numbered correction commands.

- [ ] **Step 1: Write failing tests for all main structural points**

```ts
function reliableMap(
  points: readonly Landmark[],
  overrides: Partial<Record<LandmarkName, Assessability>> = {},
): LandmarkReliabilityMap {
  return new Map(points.map((point) => {
    const assessability = overrides[point.name] ?? 'assessable';
    return [point.name, {
      name: point.name,
      assessability,
      confidence: assessability === 'assessable' ? 'high' : 'low',
      reasons: assessability === 'assessable' ? [] : ['implausible-chain'],
    }];
  }));
}

function hasLabel(command: DrawingCommand): command is Extract<DrawingCommand, { label: 1 | 2 | 3 }> {
  return 'label' in command;
}

function annotationFinding(id: string, joints: readonly LandmarkName[]): Observation {
  return {
    id,
    ruleId: id,
    dedupeKey: id,
    region: 'supporting-leg',
    priority: 'stability',
    confidence: 'high',
    evidence: joints,
    annotation: [{ observationId: id, type: 'region', joints }],
    assessability: 'assessable',
    issue: 'Visible issue.',
    action: 'Correct it.',
    direction: 'correct the visible line',
    severity: 0.5,
  };
}

const selectedTopTwo = [
  annotationFinding('one', ['left_knee']),
  annotationFinding('two', ['right_hip']),
] as const;

it('emits neutral dots for every reliable main structural landmark', () => {
  const commands = buildAnnotationCommands([], landmarks, reliableMap(landmarks), 'left');
  expect(commands.filter((item) => item.type === 'structural-joint').map((item) => item.joint)).toEqual(expect.arrayContaining([
    'nose', 'left_ear', 'right_ear',
    'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow', 'left_wrist', 'right_wrist',
    'left_hip', 'right_hip', 'left_knee', 'right_knee', 'left_ankle', 'right_ankle',
    'left_heel', 'right_heel', 'left_foot_index', 'right_foot_index',
  ]));
});

it('omits an unreliable point and every segment attached to it', () => {
  const reliability = reliableMap(landmarks, { left_knee: 'unassessable' });
  const commands = buildAnnotationCommands([], landmarks, reliability, 'left');
  expect(commands).not.toContainEqual(expect.objectContaining({ type: 'structural-joint', joint: 'left_knee' }));
  expect(commands).not.toContainEqual(expect.objectContaining({ type: 'skeleton-segment', to: 'left_knee' }));
});

it('numbers only observations selected for written feedback', () => {
  const commands = buildAnnotationCommands(selectedTopTwo, landmarks, reliableMap(landmarks), 'left');
  expect(commands.filter(hasLabel).map((item) => item.label)).toEqual(expect.arrayContaining([1, 2]));
  expect(commands.some((item) => hasLabel(item) && item.label === 3)).toBe(false);
});
```

- [ ] **Step 2: Run annotation tests and verify structural dots are missing**

Run: `pnpm test -- src/annotation/buildCommands.test.ts src/annotation/drawAnnotatedPose.test.ts`

Expected: FAIL because `structural-joint` and reliability filtering are not implemented.

- [ ] **Step 3: Extend drawing commands and structural connections**

Add:

```ts
| { type: 'structural-joint'; joint: LandmarkName }
```

Use one exported `MAIN_STRUCTURAL_LANDMARKS` list and these connections:

```ts
const STRUCTURAL_SEGMENTS = [
  ['left_shoulder', 'right_shoulder'],
  ['left_shoulder', 'left_elbow'], ['left_elbow', 'left_wrist'],
  ['right_shoulder', 'right_elbow'], ['right_elbow', 'right_wrist'],
  ['left_shoulder', 'left_hip'], ['right_shoulder', 'right_hip'], ['left_hip', 'right_hip'],
  ['left_hip', 'left_knee'], ['left_knee', 'left_ankle'],
  ['right_hip', 'right_knee'], ['right_knee', 'right_ankle'],
  ['left_ankle', 'left_heel'], ['left_heel', 'left_foot_index'], ['left_ankle', 'left_foot_index'],
  ['right_ankle', 'right_heel'], ['right_heel', 'right_foot_index'], ['right_ankle', 'right_foot_index'],
] as const;
```

Nose and ears receive neutral dots but no face-outline connections. Emit a segment only if both endpoints are assessable. Emit correction commands only if every instruction joint is assessable.

- [ ] **Step 4: Draw neutral dots before numbered corrections**

In `drawAnnotatedPose`, keep image first, skeleton segments second, then add a neutral-dot pass before correction markers:

```ts
const structuralRadius = Math.max(2.5, shorterSide / 220);
context.globalAlpha = 0.78;
drawNeutralJoint(context, point.x, point.y, structuralRadius);
context.globalAlpha = 1;
```

Use `SKELETON_COLOUR` for the fill and a pale outline for contrast. Numbered dark markers and arrows remain last and visually dominant.

- [ ] **Step 5: Run the annotation and download suites**

Run: `pnpm test -- src/annotation`

Expected: PASS, including correct 4096 rendering, immutable landmarks, and download output.

- [ ] **Step 6: Commit the structural overlay**

```bash
git add src/domain/types.ts src/annotation
git commit -m "feat: show reliable full-body landmarks"
```

---

### Task 6: Pipeline and Mobile Result Integration

**Files:**

- Modify: `src/pipeline/analyzePose.ts:1-133`
- Modify: `src/pipeline/analyzePose.test.ts:1-112`
- Modify: `src/quality/types.ts:15-28`
- Modify: `src/ui/CheckCard.tsx:1-55`
- Modify: `src/ui/CheckCard.test.tsx:1-52`
- Modify: `src/ui/ResultCard.tsx:1-79`
- Modify: `src/ui/ResultCard.test.tsx:1-47`
- Modify: `src/app/App.tsx:1-92`
- Modify: `src/app/App.test.tsx:30-159`

**Interfaces:**

- Consumes: decoded normalisation metadata, landmark reliability, structured measurements, de-duplicated observations.
- Produces: unchanged `AnalysisOutcome` status flow plus `quality.imageWasResized` for Check and reliable drawing commands for Result.

- [ ] **Step 1: Write a failing pipeline-order test**

```ts
function resizedDecodedImage(
  width: number,
  height: number,
  originalWidth: number,
  originalHeight: number,
): DecodedImage {
  const source = document.createElement('canvas');
  source.width = width;
  source.height = height;
  return {
    source,
    width,
    height,
    normalisation: { wasResized: true, originalWidth, originalHeight },
    dispose: vi.fn(),
  };
}

function servicesThatRecord(calls: string[], decoded: DecodedImage): AnalysisServices {
  const landmarks = landmarkPerson();
  const reliability = evaluateLandmarkReliability(landmarks, request.expectedView);
  return {
    detector: {
      detect: async () => { calls.push('detect'); return { people: [landmarks], sourceWidth: decoded.width, sourceHeight: decoded.height }; },
      close: vi.fn(),
    },
    decode: async () => decoded,
    metrics: () => { calls.push('metrics'); return { meanLuminance: 0.5, contrast: 0.2, edgeEnergy: 0.1 }; },
    quality: () => { calls.push('quality'); return { status: 'pass', reasons: [], unassessableRegions: [] }; },
    reliability: () => { calls.push('reliability'); return reliability; },
    measure: () => { calls.push('measure'); return measurePose(landmarks, 'left', reliability, request.expectedView); },
    evaluate: () => { calls.push('evaluate'); return []; },
    deduplicate: (items) => { calls.push('deduplicate'); return items; },
    feedback: () => { calls.push('feedback'); return { topCorrections: [], fullBodyReview: [] }; },
    annotations: () => { calls.push('annotations'); return []; },
  };
}

it('passes one normalised source through metrics, detection, reliability, measurement, and annotations', async () => {
  const calls: string[] = [];
  const decoded = resizedDecodedImage(4096, 2048, 8000, 4000);
  const outcome = await analyzePose(request, servicesThatRecord(calls, decoded));

  expect(calls).toEqual(['metrics', 'detect', 'quality', 'reliability', 'measure', 'evaluate', 'deduplicate', 'feedback', 'annotations']);
  expect(outcome).toMatchObject({ status: 'success', quality: { imageWasResized: true } });
});
```

- [ ] **Step 2: Write failing UI tests for resize and insufficient evidence**

```tsx
it('shows the resize notice without adding another step', () => {
  render(<CheckCard report={{ status: 'pass', reasons: [], unassessableRegions: [], imageWasResized: true }} {...handlers} />);
  expect(screen.getByText('Large photo resized for analysis. Its proportions were preserved.')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Analyse position' })).toBeEnabled();
});

it('shows fewer than three corrections and evidence-insufficient body copy', () => {
  render(<ResultCard result={resultWithOneCorrectionAndUnassessableHead} image={null} onAnotherPhoto={vi.fn()} />);
  expect(screen.getAllByRole('listitem')).toHaveLength(1);
  expect(screen.getByText('Not enough evidence in this photo to recommend a change.')).toBeVisible();
});
```

- [ ] **Step 3: Run pipeline and UI tests and verify failures**

Run: `pnpm test -- src/pipeline/analyzePose.test.ts src/ui/CheckCard.test.tsx src/ui/ResultCard.test.tsx src/app/App.test.tsx`

Expected: FAIL because reliability/de-duplication are not wired and resize metadata is not shown.

- [ ] **Step 4: Wire the pipeline in the specified order**

Extend `AnalysisServices` with these test seams:

```ts
reliability?: typeof evaluateLandmarkReliability;
measure?: (
  landmarks: readonly Landmark[],
  supportingSide: SupportingSide,
  reliability: LandmarkReliabilityMap,
  view: ViewType,
) => MeasurementSet;
deduplicate?: typeof deduplicateObservations;
annotations?: (
  observations: readonly Observation[],
  landmarks: readonly Landmark[],
  reliability: LandmarkReliabilityMap,
  supportingSide: SupportingSide,
) => readonly DrawingCommand[];
```

After quality passes, evaluate reliability, measure with it, evaluate rules, de-duplicate observations, compose feedback, select exactly the observations referenced by `topCorrections`, and build annotations with the same reliability map. Add `imageWasResized: decoded.normalisation.wasResized` to the returned quality report.

Map `normalisation-failed` to a retake report in `dimensionRetake` (rename it `imageRetake`). Retain the generic error only for unexpected failures.

- [ ] **Step 5: Show resize metadata in Check without changing navigation**

Add `imageWasResized?: boolean` to `QualityReport`. In `CheckCard`, render this status note after the passed-check list:

```tsx
{report.imageWasResized && (
  <p className="status-note">Large photo resized for analysis. Its proportions were preserved.</p>
)}
```

Do not add a tab, button, modal, or confirmation step.

- [ ] **Step 6: Preserve lifecycle and coordinate ownership**

Update App test doubles to include `normalisation`. Verify a stale or cancelled resized canvas is disposed exactly once, a successful normalised source remains available through Result/download, and reset releases it. The preview may continue using the original object URL before analysis; Result must use `decoded.current.source`, which is the normalised image.

- [ ] **Step 7: Run integration tests**

Run: `pnpm test -- src/pipeline src/ui src/app`

Expected: PASS with one active card at a time, existing retake controls, resize notice, and exact annotation-to-feedback ordering.

- [ ] **Step 8: Commit pipeline and UI integration**

```bash
git add src/pipeline src/quality src/ui src/app
git commit -m "feat: integrate conservative pose analysis"
```

---

### Task 7: Reported-Photo Regression and End-to-End Verification

**Files:**

- Create: `tests/fixtures/retire-front-straight-support.ts`
- Modify: `src/rules/retireRules.test.ts`
- Modify: `src/pipeline/analyzePose.test.ts`
- Modify: `tests/e2e/mobile-flow.spec.ts`
- Modify: `src/app/e2eServices.ts` only if the fixture service type requires it

**Interfaces:**

- Consumes: the complete conservative pipeline.
- Produces: a privacy-safe landmark regression fixture and release-level verification evidence.

- [ ] **Step 1: Add a landmark-only regression fixture for the reported failure**

Create a 33-landmark Retiré / Passé fixture derived from the existing anonymous acceptable fixture, without image pixels or personally identifying metadata:

```ts
import acceptable from './retire-acceptable.json';
import type { Landmark, SupportingSide, ViewType } from '../../src/domain/types';

const source = acceptable as {
  position: 'retire-passe';
  supportingSide: SupportingSide;
  landmarks: readonly Landmark[];
};

export const retireFrontStraightSupport = {
  position: source.position,
  supportingSide: 'left' as const,
  view: 'front' as ViewType,
  expectedPresentRuleIds: ['pelvis-unlevel'] as const,
  expectedAbsentRuleIds: [
    'supporting-knee-bent',
    'supporting-ankle-not-stacked',
    'retire-stack-over-support',
  ] as const,
  landmarks: source.landmarks.map((point) => point.name === 'right_hip'
    ? { ...point, y: 0.66 }
    : point),
};
```

This keeps the left supporting hip, knee, and ankle collinear while creating an independently testable visible pelvis slope. Do not add the source photograph, screenshot, filename, face crop, or EXIF data.

- [ ] **Step 2: Write the failing regression assertion before final fixture calibration**

```ts
it('does not call the reported straight supporting leg bent or make unsupported stacking claims', () => {
  const fixture = retireFrontStraightSupport;
  const reliability = evaluateLandmarkReliability(fixture.landmarks, fixture.view);
  const measurements = measurePose(fixture.landmarks, fixture.supportingSide, reliability, fixture.view);
  const ids = deduplicateObservations(evaluateRules(
    [...COMMON_RULES, ...RETIRE_RULES],
    { ...fixture, measurements, reliability },
  )).filter((item) => item.assessability === 'assessable').map((item) => item.ruleId);

  for (const ruleId of fixture.expectedPresentRuleIds) expect(ids).toContain(ruleId);
  for (const ruleId of fixture.expectedAbsentRuleIds) expect(ids).not.toContain(ruleId);
  expect([
    FEEDBACK_COPY['pelvis-unlevel'].high,
    FEEDBACK_COPY['pelvis-unlevel'].medium,
    FEEDBACK_COPY['supporting-lateral-offset'].high,
    FEEDBACK_COPY['supporting-lateral-offset'].medium,
  ].join(' '))
    .not.toMatch(/directly over|centre of mass|forward|backward/i);
});
```

- [ ] **Step 3: Run the regression test and confirm it fails before fixture/rule completion**

Run: `pnpm test -- src/rules/retireRules.test.ts -t "reported straight supporting leg"`

Expected: FAIL until the fixture and conservative rule path are complete; then PASS.

- [ ] **Step 4: Extend the mobile E2E fixture**

Make the injected decoded source report a resized normalisation and provide one correction plus an unassessable head region. Add assertions that:

```ts
await expect(page.getByText('Large photo resized for analysis. Its proportions were preserved.')).toBeVisible();
await page.getByRole('button', { name: 'Analyse position' }).click();
await expect(page.getByLabel('Your feedback')).toBeVisible();
await expect(page.locator('.corrections > li')).toHaveCount(1);
await expect(page.getByText('Not enough evidence in this photo to recommend a change.')).toBeVisible();
await expect(page.locator('main.app-card > section:visible')).toHaveCount(1);
```

- [ ] **Step 5: Run focused and full automated verification**

Run: `pnpm test`

Expected: all Vitest suites PASS.

Run: `pnpm build`

Expected: TypeScript type-check and Vite production build PASS.

Run: `pnpm test:e2e`

Expected: all Playwright mobile-flow and accessibility tests PASS with no serious or critical accessibility violations.

- [ ] **Step 6: Perform manual visual verification**

Start the local production-equivalent site and test one portrait image at ordinary resolution and one image above 4096 pixels. Confirm:

- only one card is visible on a phone-sized viewport;
- the resize notice appears only for the large image;
- neutral nose, ear, shoulder, elbow, wrist, hip, knee, ankle, heel, and toe points are legible but subdued;
- unreliable points and attached segments are absent;
- dark numbered corrections remain visually dominant and match the written order;
- the downloaded annotated PNG aligns with the on-screen result;
- a result with one supported issue contains one numbered correction, not filler items.

- [ ] **Step 7: Confirm the rollback milestone still exists and commit regression coverage**

Run: `git rev-parse milestone/aligne-v1-deployed`

Expected: the tag resolves to the pre-change stable release commit.

```bash
git add tests/fixtures/retire-front-straight-support.ts src/rules/retireRules.test.ts src/pipeline/analyzePose.test.ts tests/e2e/mobile-flow.spec.ts src/app/e2eServices.ts
git commit -m "test: cover conservative pose regression"
```

- [ ] **Step 8: Record final evidence before any deployment**

Run: `git status --short`

Expected: no output.

Run: `git log --oneline milestone/aligne-v1-deployed..HEAD`

Expected: only the approved design, plan, and implementation commits for this increment. Save the full test/build/E2E output in the task handoff. Deployment is a separate final action using the repository's Sites build and hosting workflow after the implementation is reviewed.

# Ballet Position Feedback MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile-first English web application that evaluates one selected ballet position from one guided photo, returns three prioritised corrections plus a full-body review, and produces a downloadable annotated result.

**Architecture:** Use a static React and TypeScript application built with Vite. MediaPipe Pose Landmarker runs in the browser behind a `PoseDetector` interface; pure geometry and position-rule modules convert landmarks into structured observations, while deterministic copy and canvas renderers produce feedback and annotations. Photos and results remain in memory, are never persisted or uploaded, and the frame-based domain model can later accept multiple photos or video key frames.

**Tech Stack:** Node.js 24, pnpm, React, TypeScript, Vite, MediaPipe Tasks Vision, Vitest, React Testing Library, Playwright, axe-core, Canvas 2D API.

**Spec:** `docs/superpowers/specs/2026-09-03-ballet-position-feedback-design.md`

## Global Constraints

- The MVP accepts one still photo and requires manual selection of Arabesque, Attitude derrière, or Retiré / Passé plus left or right supporting side.
- Arabesque and Attitude derrière use an approximately 45-degree side view; Retiré / Passé uses a frontal view.
- All interface copy and feedback are English; French ballet terms remain untranslated.
- The phone interface displays exactly one card at a time across Select, Frame, Check, and Result stages.
- Use a restrained rose and soft-pink ballet visual direction with WCAG AA contrast; never use colour as the only status cue.
- User-facing feedback contains natural language, never joint angles, numeric scores, or numeric confidence.
- Medium-confidence observations use qualified language; low-confidence and unassessable observations do not become corrections.
- The system must not infer pain, injury, force, muscular engagement, or hidden internal hip rotation.
- The rule engine, not the language layer, is the source of every correction.
- No accounts, history, local storage, IndexedDB, analytics, or user-photo training consent are included.
- Uploaded photos stay in browser memory; object URLs, canvases, and decoded images are released on replacement, reset, or page exit.
- The domain model represents an analysis as a session containing frames so multi-view photos and video key frames can be added without changing the feedback contract.
- Exact port de bras scoring is excluded from the MVP because the user does not select a port de bras variant. Arm feedback is limited to visible shoulder asymmetry and clearly collapsed elbow lines; head feedback is limited to extreme lateral tilt relative to the torso.
- A completed MVP still requires the product owner's labelled real-photo set before the 80% human-agreement acceptance criterion can be claimed.

---

## Planned File Structure

```text
.
├── index.html                         # Vite entry document
├── package.json                       # scripts and dependencies
├── pnpm-lock.yaml                     # resolved dependency versions
├── tsconfig.json                      # strict shared TypeScript settings
├── vite.config.ts                     # Vite and Vitest configuration
├── playwright.config.ts               # phone-sized browser test projects
├── scripts/
│   └── sync-mediapipe-assets.mjs      # local WASM and model asset preparation
├── public/
│   ├── models/                        # generated Pose Landmarker model cache
│   └── vendor/mediapipe/              # generated MediaPipe WASM cache
├── src/
│   ├── main.tsx                       # React bootstrap
│   ├── app/App.tsx                    # composition root and service injection
│   ├── app/app.css                    # rose theme, one-card layout, responsive styles
│   ├── domain/types.ts                # stable session, landmark, observation, result types
│   ├── domain/landmarks.ts            # landmark names and left/right helpers
│   ├── session/sessionReducer.ts      # four-stage state machine
│   ├── session/useObjectUrl.ts        # image URL lifecycle and cleanup
│   ├── image/validateImageFile.ts     # type and byte-size validation
│   ├── image/decodeImage.ts           # EXIF-aware browser decoding
│   ├── image/imageMetrics.ts           # luminance, contrast, and sharpness metrics
│   ├── pose/PoseDetector.ts           # replaceable detector interface
│   ├── pose/MediaPipePoseDetector.ts  # browser MediaPipe adapter
│   ├── quality/types.ts               # quality report and retake reason contracts
│   ├── quality/evaluateQuality.ts     # person, crop, visibility, view, and image checks
│   ├── quality/messages.ts            # exact retake copy for quality failures
│   ├── analysis/geometry.ts           # pure angle, slope, distance, and normalisation helpers
│   ├── analysis/measurePose.ts        # body-normalised measurement extraction
│   ├── rules/types.ts                 # rule definition and rule context contracts
│   ├── rules/evaluateRules.ts         # common rule runner
│   ├── rules/commonRules.ts           # supporting leg, pelvis, torso, and shoulder checks
│   ├── rules/arabesqueRules.ts        # Arabesque-specific checks
│   ├── rules/attitudeRules.ts         # Attitude derrière-specific checks
│   ├── rules/retireRules.ts           # Retiré / Passé-specific checks
│   ├── feedback/copy.ts               # approved high/medium-confidence English wording
│   ├── feedback/composeFeedback.ts    # Top 3 and full-body review selection
│   ├── annotation/buildCommands.ts    # observation-to-drawing-command mapping
│   ├── annotation/drawAnnotatedPose.ts# Canvas rendering
│   ├── annotation/renderDownload.ts   # combined PNG result with feedback text
│   ├── pipeline/analyzePose.ts        # end-to-end orchestration
│   └── ui/
│       ├── StepTabs.tsx               # Select, Frame, Check, Result navigation
│       ├── SelectCard.tsx             # position and supporting-side controls
│       ├── FrameCard.tsx              # capture guide and file input
│       ├── CheckCard.tsx              # quality pass/fail and retake reasons
│       ├── ResultCard.tsx             # annotation, Top 3, review, and download
│       └── Disclaimer.tsx             # practice-assistant safety copy
├── tests/
│   ├── builders/landmarks.ts          # readable pose landmark fixture builder
│   ├── fixtures/*.json                # synthetic landmark cases with expected observations
│   └── e2e/mobile-flow.spec.ts        # phone flow and accessibility checks
└── evaluation/
    ├── dataset.schema.ts              # labelled-photo manifest validation
    ├── scoreAgreement.ts              # 2-of-3 and 80% scoring
    ├── scoreAgreement.test.ts         # metric unit tests
    └── README.md                      # exact real-photo evaluation procedure
```

Generated model and WASM files are ignored by Git and recreated by `pnpm sync:assets`.

## Spec Coverage Map

- Product scope, users, and non-goals: Global Constraints, Tasks 1–3, and Task 11.
- Standard library and the three position rubrics: Tasks 6–9.
- Hybrid pose extraction, geometry, rules, feedback, and annotation pipeline: Tasks 4–11.
- Confidence-aware beginner inference and two-dimensional-image limits: Tasks 5–9.
- Single-card rose mobile experience: Tasks 2, 3, 5, and 11.
- Error handling and retake guidance: Tasks 3, 5, and 11.
- No-account privacy and in-memory disposal: Tasks 3, 11, and 12.
- Human agreement, invalid-photo checks, and accessibility: Task 12.
- Multi-view and video extension boundary: Tasks 1 and 4 through the frame and detector interfaces.

---

### Task 1: Application Foundation and Stable Domain Contracts

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/domain/types.ts`
- Create: `src/domain/landmarks.ts`
- Create: `src/domain/types.test.ts`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: none.
- Produces: `PoseName`, `SupportingSide`, `ViewType`, `PoseFrame`, `Landmark`, `LandmarkSet`, `Observation`, `FeedbackItem`, `AnalysisResult`, and `createAnalysisSession()`.

- [ ] **Step 1: Add the project and test configuration**

Create scripts with these names and install the resolved versions into `pnpm-lock.yaml`:

```json
{
  "name": "aligne-ballet-feedback",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "sync:assets": "node scripts/sync-mediapipe-assets.mjs"
  }
}
```

Run:

```bash
pnpm add react react-dom @mediapipe/tasks-vision zod
pnpm add -D vite @vitejs/plugin-react typescript vitest jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom @types/react @types/react-dom @playwright/test @axe-core/playwright
```

Use `strict: true`, `noUncheckedIndexedAccess: true`, and `exactOptionalPropertyTypes: true` in `tsconfig.json`. Configure Vitest for `jsdom`, a `src/test/setup.ts` file, and coverage-free local runs. Add `.DS_Store`, `dist/`, `coverage/`, `playwright-report/`, `test-results/`, `public/models/`, and `public/vendor/mediapipe/` to `.gitignore`.

- [ ] **Step 2: Write the failing domain-contract test**

```ts
import { describe, expect, it } from 'vitest';
import { createAnalysisSession } from './types';

describe('createAnalysisSession', () => {
  it('creates one image frame slot without coupling the session to one frame', () => {
    const session = createAnalysisSession('arabesque', 'left', 'three-quarter-side', '2026-09-03T12:00:00.000Z');
    expect(session).toMatchObject({
      position: 'arabesque',
      supportingSide: 'left',
      expectedViews: ['three-quarter-side'],
      frames: [],
      status: 'select',
    });
  });
});
```

- [ ] **Step 3: Run the focused test and verify the expected failure**

Run: `pnpm test -- src/domain/types.test.ts`  
Expected: FAIL because `src/domain/types.ts` or `createAnalysisSession` does not exist.

- [ ] **Step 4: Implement the domain contracts**

Use these discriminated unions and signatures:

```ts
export type PoseName = 'arabesque' | 'attitude-derriere' | 'retire-passe';
export type SupportingSide = 'left' | 'right';
export type ViewType = 'front' | 'three-quarter-side';
export type FrameKind = 'image' | 'video-keyframe';
export type Confidence = 'high' | 'medium' | 'low';
export type Assessability = 'assessable' | 'unassessable';
export type Priority = 'stability' | 'structure' | 'line';
export type AnalysisStatus = 'select' | 'frame' | 'check' | 'result';
export type BodyRegion =
  | 'supporting-leg' | 'working-leg' | 'pelvis' | 'torso'
  | 'shoulders-arms' | 'head' | 'feet';

export interface Landmark {
  name: LandmarkName;
  x: number;
  y: number;
  z?: number;
  visibility: number;
}

export interface LandmarkSet {
  people: ReadonlyArray<ReadonlyArray<Landmark>>;
  sourceWidth: number;
  sourceHeight: number;
}

export interface PoseFrame {
  id: string;
  kind: FrameKind;
  view: ViewType;
  sourceWidth: number;
  sourceHeight: number;
  createdAt: string;
}

export interface ObservationBase {
  id: string;
  ruleId: string;
  region: BodyRegion;
  priority: Priority;
  confidence: Confidence;
  evidence: readonly string[];
  annotation: readonly AnnotationInstruction[];
}

export type Observation =
  | (ObservationBase & {
      assessability: 'assessable';
      issue: string;
      action: string;
      direction: string;
      severity: number;
    })
  | (ObservationBase & {
      assessability: 'unassessable';
      issue: null;
      action: null;
      direction: null;
      severity: null;
      confidence: 'low';
    });

export interface AnnotationInstruction {
  observationId: string;
  type: 'joint' | 'region' | 'arrow';
  joints: readonly LandmarkName[];
  dx?: number;
  dy?: number;
}

export type DrawingCommand =
  | { type: 'skeleton-segment'; from: LandmarkName; to: LandmarkName }
  | { type: 'highlight-joint'; observationId: string; joint: LandmarkName; label: 1 | 2 | 3 }
  | { type: 'highlight-region'; observationId: string; joints: readonly LandmarkName[]; label: 1 | 2 | 3 }
  | { type: 'direction-arrow'; observationId: string; anchor: LandmarkName; dx: number; dy: number; label: 1 | 2 | 3 };

export interface FeedbackItem {
  observationId: string;
  text: string;
  region: BodyRegion;
  priority: Priority;
  confidence: Exclude<Confidence, 'low'>;
}

export interface FullBodySection {
  region: BodyRegion;
  status: 'finding' | 'clear' | 'unassessable';
  items: readonly FeedbackItem[];
}

export interface AnalysisResult {
  sessionId: string;
  position: PoseName;
  landmarks: readonly Landmark[];
  topCorrections: readonly FeedbackItem[];
  fullBodyReview: readonly FullBodySection[];
  annotations: readonly DrawingCommand[];
  createdAt: string;
}

export interface AnalysisSession {
  id: string;
  position: PoseName;
  supportingSide: SupportingSide;
  expectedViews: readonly ViewType[];
  frames: readonly PoseFrame[];
  status: AnalysisStatus;
  createdAt: string;
}

export function createAnalysisSession(
  position: PoseName,
  supportingSide: SupportingSide,
  view: ViewType,
  createdAt = new Date().toISOString(),
): AnalysisSession;
```

Define the 33 MediaPipe landmark names once in `src/domain/landmarks.ts`, plus `sideLandmark(side, joint)` and `oppositeSide(side)` helpers.

- [ ] **Step 5: Run type, unit, and production-build checks**

Run: `pnpm test -- src/domain/types.test.ts && pnpm build`  
Expected: the focused test passes and Vite creates `dist/` with no TypeScript error.

- [ ] **Step 6: Commit the foundation**

```bash
git add package.json pnpm-lock.yaml tsconfig.json vite.config.ts index.html src/main.tsx src/domain .gitignore
git commit -m "chore: scaffold ballet feedback web app"
```

---

### Task 2: Four-Stage Session State and One-Card Navigation

**Files:**
- Create: `src/session/sessionReducer.ts`
- Create: `src/session/sessionReducer.test.ts`
- Create: `src/quality/types.ts`
- Create: `src/ui/StepTabs.tsx`
- Create: `src/ui/StepTabs.test.tsx`
- Create: `src/app/App.tsx`
- Create: `src/app/app.css`

**Interfaces:**
- Consumes: `PoseName`, `SupportingSide`, `AnalysisResult` from Task 1 and the `QualityReport` contract defined in this task.
- Produces: `SessionState`, `SessionAction`, `sessionReducer()`, and `<StepTabs stage unlockedStages onSelect />`.

- [ ] **Step 1: Write reducer tests for stage locks and invalidation**

```ts
it('does not open Result before analysis succeeds', () => {
  const selected = sessionReducer(initialSessionState, {
    type: 'selection-confirmed', position: 'arabesque', supportingSide: 'left',
  });
  expect(sessionReducer(selected, { type: 'stage-requested', stage: 'result' }).stage).toBe('frame');
});

it('invalidates an existing result when the selected position changes', () => {
  const changed = sessionReducer(stateWithResult, {
    type: 'position-changed', position: 'retire-passe',
  });
  expect(changed.result).toBeNull();
  expect(changed.stage).toBe('select');
});
```

- [ ] **Step 2: Run the reducer test and verify failure**

Run: `pnpm test -- src/session/sessionReducer.test.ts`  
Expected: FAIL because the reducer is missing.

- [ ] **Step 3: Implement the explicit state machine**

```ts
export type Stage = 'select' | 'frame' | 'check' | 'result';

export interface ImageSelection {
  file: File;
  previewUrl: string;
}

export type QualityReasonCode =
  | 'no-person' | 'multiple-people' | 'body-out-of-frame'
  | 'required-joints-not-visible' | 'wrong-camera-view'
  | 'too-dark' | 'too-bright' | 'low-contrast' | 'blurred';

// src/quality/types.ts
export interface QualityReport {
  status: 'pass' | 'partial' | 'fail';
  reasons: readonly { code: QualityReasonCode; message: string }[];
  unassessableRegions: readonly BodyRegion[];
}

export interface SessionState {
  stage: Stage;
  unlockedStages: ReadonlySet<Stage>;
  position: PoseName | null;
  supportingSide: SupportingSide | null;
  image: ImageSelection | null;
  quality: QualityReport | null;
  result: AnalysisResult | null;
  error: string | null;
}

export type SessionAction =
  | { type: 'selection-confirmed'; position: PoseName; supportingSide: SupportingSide }
  | { type: 'position-changed'; position: PoseName }
  | { type: 'image-selected'; image: ImageSelection }
  | { type: 'quality-completed'; report: QualityReport }
  | { type: 'analysis-succeeded'; result: AnalysisResult }
  | { type: 'analysis-failed'; message: string }
  | { type: 'stage-requested'; stage: Stage }
  | { type: 'reset' };
```

Keep transition rules in a `TRANSITIONS` map and return the unchanged state for locked stage requests.

- [ ] **Step 4: Write the failing navigation component test**

```tsx
it('renders one selected tab and disables locked Result', () => {
  render(<StepTabs stage="frame" unlockedStages={new Set(['select', 'frame'])} onSelect={vi.fn()} />);
  expect(screen.getByRole('tab', { name: 'Frame' })).toHaveAttribute('aria-selected', 'true');
  expect(screen.getByRole('tab', { name: 'Result' })).toBeDisabled();
});
```

- [ ] **Step 5: Implement the one-card shell and ballet theme**

Render one `<main className="app-card">` and conditionally mount only the current stage card. Use four native tab buttons with `role="tab"`, `aria-selected`, and disabled locked stages. Define the approved palette in `app.css`:

```css
:root {
  --page: #fbf4f6;
  --surface: #fffafb;
  --soft: #f8e3e9;
  --accent: #a9506c;
  --deep: #6f3448;
  --ink: #382a30;
  --muted: #755f67;
  --line: #dfbdc8;
}

.app-shell { width: min(100% - 24px, 390px); margin-inline: auto; }
.app-card { min-height: 520px; border-radius: 24px; background: var(--surface); }
```

Pair icons or text with every status colour. Preserve a 44-by-44 CSS-pixel minimum target for touch controls.

- [ ] **Step 6: Verify state and navigation behavior**

Run: `pnpm test -- src/session src/ui/StepTabs.test.tsx && pnpm build`  
Expected: reducer and tab tests pass; the build contains one card container rather than four simultaneous stage cards.

- [ ] **Step 7: Commit the navigation slice**

```bash
git add src/session src/quality/types.ts src/ui/StepTabs.tsx src/ui/StepTabs.test.tsx src/app
git commit -m "feat: add single-card analysis flow"
```

---

### Task 3: Private Image Intake and Decoding

**Files:**
- Create: `src/image/validateImageFile.ts`
- Create: `src/image/validateImageFile.test.ts`
- Create: `src/image/decodeImage.ts`
- Create: `src/session/useObjectUrl.ts`
- Create: `src/session/useObjectUrl.test.tsx`
- Create: `src/ui/FrameCard.tsx`

**Interfaces:**
- Consumes: `ViewType`, stage actions from Tasks 1–2.
- Produces: `validateImageFile(file): ImageFileValidation`, `decodeImage(file): Promise<DecodedImage>`, and `useObjectUrl(file): string | null`.

- [ ] **Step 1: Write file-validation tests**

```ts
it.each(['image/jpeg', 'image/png', 'image/webp'])('accepts %s', (type) => {
  expect(validateImageFile(new File(['x'], 'pose', { type }))).toEqual({ ok: true });
});

it('rejects a file above 12 MiB', () => {
  const file = new File([new Uint8Array(12 * 1024 * 1024 + 1)], 'pose.jpg', { type: 'image/jpeg' });
  expect(validateImageFile(file)).toEqual({ ok: false, code: 'file-too-large' });
});
```

- [ ] **Step 2: Run the test and verify failure**

Run: `pnpm test -- src/image/validateImageFile.test.ts`  
Expected: FAIL because `validateImageFile` is missing.

- [ ] **Step 3: Implement validation and decoding**

Accept JPEG, PNG, and WebP up to 12 MiB. Decode with `createImageBitmap(file, { imageOrientation: 'from-image' })`; fall back to an `HTMLImageElement` backed by a temporary object URL. Reject decoded dimensions below 480 pixels on the shortest side or above 8192 pixels on either side with exact codes `image-too-small` and `image-too-large`.

```ts
export type ImageErrorCode =
  | 'unsupported-type' | 'file-too-large' | 'image-too-small'
  | 'image-too-large' | 'decode-failed';

export interface DecodedImage {
  source: ImageBitmap | HTMLImageElement;
  width: number;
  height: number;
  dispose(): void;
}
```

- [ ] **Step 4: Test and implement object-URL cleanup**

```tsx
it('revokes the previous URL when the file changes', () => {
  const revoke = vi.spyOn(URL, 'revokeObjectURL');
  const { rerender } = renderHook(({ file }) => useObjectUrl(file), { initialProps: { file: firstFile } });
  rerender({ file: secondFile });
  expect(revoke).toHaveBeenCalledTimes(1);
});
```

The hook revokes URLs on replacement and unmount. `FrameCard` uses `<input type="file" accept="image/jpeg,image/png,image/webp">`, allowing the mobile browser to offer either camera capture or the photo library. It shows the pose-specific camera guide and never stores file contents outside React state.

- [ ] **Step 5: Verify image intake**

Run: `pnpm test -- src/image src/session/useObjectUrl.test.tsx && pnpm build`  
Expected: valid file types pass, invalid files produce exact error codes, and URL cleanup tests pass.

- [ ] **Step 6: Commit image intake**

```bash
git add src/image src/session/useObjectUrl.ts src/session/useObjectUrl.test.tsx src/ui/FrameCard.tsx
git commit -m "feat: add private photo intake"
```

---

### Task 4: Replaceable Pose Detector and MediaPipe Browser Adapter

**Files:**
- Create: `scripts/sync-mediapipe-assets.mjs`
- Create: `src/pose/PoseDetector.ts`
- Create: `src/pose/MediaPipePoseDetector.ts`
- Create: `src/pose/MediaPipePoseDetector.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: `DecodedImage`, `LandmarkSet`, and the 33 landmark names.
- Produces: `PoseDetector.detect(source): Promise<LandmarkSet>` and `createMediaPipePoseDetector(): Promise<PoseDetector>`.

- [ ] **Step 1: Define the detector contract and failing mapping test**

```ts
export interface PoseDetector {
  detect(source: CanvasImageSource, width: number, height: number): Promise<LandmarkSet>;
  close(): void;
}

it('maps every detected person to named landmarks', () => {
  const mapped = mapMediaPipeResult(fakeTwoPersonResult, 1080, 1920);
  expect(mapped.people).toHaveLength(2);
  expect(mapped.people[0]?.find((p) => p.name === 'left-knee')).toMatchObject({ visibility: 0.93 });
});
```

- [ ] **Step 2: Run the mapping test and verify failure**

Run: `pnpm test -- src/pose/MediaPipePoseDetector.test.ts`  
Expected: FAIL because the adapter does not exist.

- [ ] **Step 3: Add deterministic local asset preparation**

`scripts/sync-mediapipe-assets.mjs` copies the installed package's complete `wasm` directory to `public/vendor/mediapipe/wasm` and downloads the versioned lite model only when absent:

```js
const modelUrl = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
const modelPath = new URL('../public/models/pose_landmarker_lite.task', import.meta.url);
```

Use `fs.cp(source, destination, { recursive: true })`, `fs.mkdir(..., { recursive: true })`, `fetch(modelUrl)`, and atomic write-to-temporary-then-rename. Add `presync:assets: "node --version"`, `predev: "pnpm sync:assets"`, and `prebuild: "pnpm sync:assets"` scripts.

- [ ] **Step 4: Implement the MediaPipe adapter**

```ts
const files = await FilesetResolver.forVisionTasks('/vendor/mediapipe/wasm');
const landmarker = await PoseLandmarker.createFromOptions(files, {
  baseOptions: { modelAssetPath: '/models/pose_landmarker_lite.task' },
  runningMode: 'IMAGE',
  numPoses: 2,
  minPoseDetectionConfidence: 0.5,
  minPosePresenceConfidence: 0.5,
});
```

Map MediaPipe output immediately into project-owned `LandmarkSet` values so no later module imports MediaPipe types. Keep `numPoses: 2` because the quality gate must distinguish one person from multiple people.

- [ ] **Step 5: Verify adapter mapping and asset sync**

Run: `pnpm sync:assets && pnpm test -- src/pose && pnpm build`  
Expected: the model and WASM assets exist locally, the fake mapping test passes, and production code compiles without leaking MediaPipe types beyond the adapter.

- [ ] **Step 6: Commit the detector slice**

```bash
git add scripts/sync-mediapipe-assets.mjs package.json pnpm-lock.yaml src/pose .gitignore
git commit -m "feat: add on-device pose detection adapter"
```

---

### Task 5: Photo Quality Gate with Specific Retake Reasons

**Files:**
- Create: `src/image/imageMetrics.ts`
- Create: `src/image/imageMetrics.test.ts`
- Create: `src/quality/evaluateQuality.ts`
- Create: `src/quality/evaluateQuality.test.ts`
- Create: `src/quality/messages.ts`
- Create: `src/ui/CheckCard.tsx`
- Create: `src/ui/CheckCard.test.tsx`

**Interfaces:**
- Consumes: `LandmarkSet`, `PoseName`, `SupportingSide`, `ViewType`, decoded pixel data.
- Produces: `QualityReport`, `QualityReason`, `evaluateQuality(input)`, and `<CheckCard report />`.

- [ ] **Step 1: Write failing quality tests for all blocking states**

```ts
it.each([
  [noPeople, 'no-person'],
  [twoPeople, 'multiple-people'],
  [croppedFeet, 'body-out-of-frame'],
  [hiddenSupportingKnee, 'required-joints-not-visible'],
])('returns a specific blocking reason', (landmarks, expected) => {
  const report = evaluateQuality(baseInput({ landmarks }));
  expect(report.status).toBe('fail');
  expect(report.reasons.map((reason) => reason.code)).toContain(expected);
});
```

- [ ] **Step 2: Run the quality tests and verify failure**

Run: `pnpm test -- src/quality/evaluateQuality.test.ts`  
Expected: FAIL because `evaluateQuality` is missing.

- [ ] **Step 3: Implement pixel metrics and landmark thresholds**

Sample a canvas downscaled to at most 256-by-256 pixels. Compute normalised mean luminance, luminance standard deviation, and mean adjacent-pixel gradient. Use these initial engineering thresholds:

```ts
export const QUALITY_THRESHOLDS = {
  minMeanLuminance: 0.10,
  maxMeanLuminance: 0.94,
  minContrast: 0.075,
  minEdgeEnergy: 0.018,
  minRequiredVisibility: 0.60,
  frameMargin: 0.02,
} as const;
```

Required landmarks are both shoulders, both hips, both knees, both ankles, both heels, and both foot indices. Wrists and elbows are optional: poor visibility makes the shoulders-and-arms region unassessable but does not block leg and pelvis analysis.

- [ ] **Step 4: Implement prescribed-view checks and retake messages**

Estimate apparent view from mean shoulder/hip width divided by torso length. Treat `front` as ratio `>= 0.55` and `three-quarter-side` as ratio from `0.25` through `0.85`; outside the expected interval yields `wrong-camera-view`. This is a broad framing heuristic, not ballet feedback.

Define exact messages:

```ts
export const QUALITY_MESSAGES: Record<QualityReasonCode, string> = {
  'no-person': 'No full body was detected. Step back and try again.',
  'multiple-people': 'Only one dancer can be analysed at a time.',
  'body-out-of-frame': 'Keep your hands and feet inside the frame.',
  'required-joints-not-visible': 'Make sure your hips, knees, ankles, and feet are visible.',
  'wrong-camera-view': 'Match the camera angle shown in the framing guide.',
  'too-dark': 'Use brighter, even lighting and try again.',
  'too-bright': 'Reduce glare or backlighting and try again.',
  'low-contrast': 'Use clearer lighting and fitted clothing that contrasts with the background.',
  'blurred': 'Hold the camera steady and retake the photo.',
};
```

- [ ] **Step 5: Render all reasons without producing corrections**

`CheckCard` renders `role="alert"` for a failed report, lists every reason, and offers `Retake photo`. A passing report lists full body, camera view, and required joints with text plus icons. A partial report lists unassessable optional regions and still offers `Analyse position`.

- [ ] **Step 6: Verify quality logic and UI**

Run: `pnpm test -- src/image/imageMetrics.test.ts src/quality src/ui/CheckCard.test.tsx`  
Expected: all blocking and partial cases pass; no failed report renders an Analyse button.

- [ ] **Step 7: Commit the quality gate**

```bash
git add src/image/imageMetrics.ts src/image/imageMetrics.test.ts src/quality src/ui/CheckCard.tsx src/ui/CheckCard.test.tsx
git commit -m "feat: add photo quality gate"
```

---

### Task 6: Geometry, Body Normalisation, and Rule Engine Core

**Files:**
- Create: `src/analysis/geometry.ts`
- Create: `src/analysis/geometry.test.ts`
- Create: `src/analysis/measurePose.ts`
- Create: `src/analysis/measurePose.test.ts`
- Create: `src/rules/types.ts`
- Create: `src/rules/evaluateRules.ts`
- Create: `src/rules/evaluateRules.test.ts`
- Create: `src/rules/commonRules.ts`
- Create: `tests/builders/landmarks.ts`

**Interfaces:**
- Consumes: named landmarks, selected supporting side, confidence and observation types.
- Produces: `angleDeg`, `slopeDeg`, `distance`, `midpoint`, `measurePose`, `Rule`, `RuleContext`, and `evaluateRules`.

- [ ] **Step 1: Write geometry tests with known coordinates**

```ts
it('returns 180 degrees for a straight knee', () => {
  expect(angleDeg({ x: 0, y: 0 }, { x: 0, y: 1 }, { x: 0, y: 2 })).toBeCloseTo(180, 5);
});

it('normalises distance by torso length', () => {
  expect(normalisedDistance({ x: 0, y: 0 }, { x: 0.5, y: 0 }, 0.25)).toBeCloseTo(2, 5);
});
```

- [ ] **Step 2: Run geometry tests and verify failure**

Run: `pnpm test -- src/analysis/geometry.test.ts`  
Expected: FAIL because the geometry helpers are missing.

- [ ] **Step 3: Implement pure geometry and measurement extraction**

Clamp cosine input to `[-1, 1]` before `Math.acos`. Return `null` rather than `NaN` for zero-length vectors. `measurePose()` calculates at least:

```ts
export interface MeasurementSet {
  torsoLength: number;
  supportingKneeAngle: number | null;
  workingKneeAngle: number | null;
  pelvisSlope: number | null;
  shoulderSlope: number | null;
  torsoLateralOffset: number | null;
  workingAnkleToSupportingKnee: number | null;
  workingKneeLateralOffset: number | null;
  workingAnkleHeightFromHip: number | null;
  supportingAnkleUnderHipOffset: number | null;
  leftElbowAngle: number | null;
  rightElbowAngle: number | null;
  headTiltFromTorso: number | null;
}
```

Measurements are body-normalised and mirror automatically when the supporting side changes.

- [ ] **Step 4: Write and implement the rule runner**

```ts
export interface Rule {
  id: string;
  positions: readonly PoseName[];
  requiredMeasurements: readonly (keyof MeasurementSet)[];
  evaluate(context: RuleContext): Observation | null;
}

export function evaluateRules(
  rules: readonly Rule[],
  context: RuleContext,
): readonly Observation[];
```

If a required measurement is `null`, emit one unassessable observation for the affected region. Derive high confidence when every evidence landmark has visibility `>= 0.80`, medium when every one is `>= 0.60`, and low otherwise. Never let deviation severity change confidence.

- [ ] **Step 5: Add common visible-alignment rules**

Implement these initial, reviewable thresholds:

- `supporting-knee-bent`: supporting knee angle below 172 degrees.
- `pelvis-unlevel`: absolute pelvis slope above 8 degrees.
- `shoulders-unlevel`: absolute shoulder slope above 10 degrees.
- `torso-off-support`: torso lateral offset above 0.12 torso lengths.
- `supporting-ankle-not-stacked`: hip-to-ankle horizontal offset above 0.18 torso lengths.
- `left-arm-line-collapsed`: left elbow angle below 110 degrees.
- `right-arm-line-collapsed`: right elbow angle below 110 degrees.
- `head-extreme-lateral-tilt`: head axis differs from torso axis by more than 25 degrees.

Common leg and balance rules must use the same observation IDs and correction directions regardless of left or right supporting side. Compute `severity` as the rule's normalised amount beyond threshold, clamped to the inclusive range from 0 through 1.

- [ ] **Step 6: Verify the pure analysis core**

Run: `pnpm test -- src/analysis src/rules/evaluateRules.test.ts`  
Expected: geometry, mirroring, null measurement, confidence, and common-rule tests pass.

- [ ] **Step 7: Commit the analysis core**

```bash
git add src/analysis src/rules/types.ts src/rules/evaluateRules.ts src/rules/evaluateRules.test.ts src/rules/commonRules.ts tests/builders
git commit -m "feat: add pose measurement and rule engine"
```

---

### Task 7: Arabesque Rule Pack and Reviewable Fixtures

**Files:**
- Create: `src/rules/arabesqueRules.ts`
- Create: `src/rules/arabesqueRules.test.ts`
- Create: `tests/fixtures/arabesque-acceptable.json`
- Create: `tests/fixtures/arabesque-bent-knees.json`
- Create: `tests/fixtures/arabesque-pelvis-compensation.json`

**Interfaces:**
- Consumes: `Rule`, `RuleContext`, `MeasurementSet`, common rules.
- Produces: `ARABESQUE_RULES`.

- [ ] **Step 1: Add three explicit landmark fixtures and failing expectations**

Each fixture contains all 33 named landmarks with `x`, `y`, and `visibility`, plus selected side and expected rule IDs. Test both a large beginner deviation and an acceptable pose:

```ts
it('finds both bent knees even when the pose is far from the standard', () => {
  const observations = evaluateFixture('arabesque-bent-knees.json');
  expect(observations.map((item) => item.ruleId)).toEqual(
    expect.arrayContaining(['supporting-knee-bent', 'arabesque-working-knee-bent']),
  );
});

it('does not force more leg height when pelvic control is already lost', () => {
  const observations = evaluateFixture('arabesque-pelvis-compensation.json');
  expect(observations.map((item) => item.ruleId)).toContain('arabesque-lower-leg-for-pelvis');
  expect(observations.map((item) => item.ruleId)).not.toContain('arabesque-lift-working-leg');
});
```

- [ ] **Step 2: Run the Arabesque tests and verify failure**

Run: `pnpm test -- src/rules/arabesqueRules.test.ts`  
Expected: FAIL because `ARABESQUE_RULES` is missing.

- [ ] **Step 3: Implement the initial Arabesque rules**

Add these rule IDs with explicit evidence landmarks and annotations:

- `arabesque-working-knee-bent`: working knee angle below 165 degrees; action is to lengthen and straighten the working leg.
- `arabesque-lower-leg-for-pelvis`: working ankle is above the hip while pelvis slope exceeds 10 degrees; action is to lower the leg slightly and re-level the pelvis.
- `arabesque-working-leg-too-low`: working ankle is more than 0.30 torso lengths below the hip, only when pelvis slope is within 8 degrees; action is to lengthen the leg back and slightly upward without changing the pelvis.
- `arabesque-torso-collapse`: torso offset exceeds 0.18 torso lengths in the direction opposite the working leg; action is to lengthen the torso forward and upward.

Use common rules for supporting knee, balance, pelvis, and shoulders. Do not add turnout, pain, muscular engagement, or exact port de bras rules.

- [ ] **Step 4: Verify fixtures, mirroring, and acceptable-pose behavior**

Run: `pnpm test -- src/rules/arabesqueRules.test.ts`  
Expected: all three fixtures pass, left/right mirroring returns the same rule IDs, and the acceptable fixture produces no stability or structure issue.

- [ ] **Step 5: Commit the Arabesque rule pack**

```bash
git add src/rules/arabesqueRules.ts src/rules/arabesqueRules.test.ts tests/fixtures/arabesque-*.json
git commit -m "feat: add arabesque assessment rules"
```

---

### Task 8: Attitude derrière and Retiré / Passé Rule Packs

**Files:**
- Create: `src/rules/attitudeRules.ts`
- Create: `src/rules/attitudeRules.test.ts`
- Create: `src/rules/retireRules.ts`
- Create: `src/rules/retireRules.test.ts`
- Create: `tests/fixtures/attitude-acceptable.json`
- Create: `tests/fixtures/attitude-common-errors.json`
- Create: `tests/fixtures/retire-acceptable.json`
- Create: `tests/fixtures/retire-common-errors.json`

**Interfaces:**
- Consumes: `Rule`, measurements, and common rules.
- Produces: `ATTITUDE_RULES` and `RETIRE_RULES`.

- [ ] **Step 1: Write failing Attitude derrière fixture tests**

```ts
it('distinguishes a straight working knee from an attitude shape', () => {
  expect(ruleIds(attitudeCommonErrors)).toContain('attitude-working-knee-too-straight');
});

it('prioritises pelvic control before raising the thigh', () => {
  const ids = ruleIds(attitudePelvisCompensation);
  expect(ids).toContain('attitude-level-pelvis');
  expect(ids).not.toContain('attitude-lift-thigh');
});
```

- [ ] **Step 2: Implement Attitude derrière rules**

Use these initial rules:

- `attitude-working-knee-too-straight`: working knee angle above 145 degrees.
- `attitude-working-knee-too-closed`: working knee angle below 65 degrees.
- `attitude-level-pelvis`: pelvis slope above 10 degrees while the working ankle is above the hip.
- `attitude-lift-thigh`: working knee is more than 0.25 torso lengths below the hip, only when pelvis slope is within 8 degrees.

Rule copy must describe visible shape and direction; it must not prescribe a single universal knee angle to the user.

- [ ] **Step 3: Write failing Retiré / Passé fixture tests**

```ts
it('detects a working foot that is far from the supporting knee', () => {
  expect(ruleIds(retireCommonErrors)).toContain('retire-place-foot-at-knee');
});

it('does not infer hip turnout from a frontal image', () => {
  expect(RETIRE_RULES.some((rule) => rule.id.includes('turnout'))).toBe(false);
});
```

- [ ] **Step 4: Implement Retiré / Passé rules**

Use these initial rules:

- `retire-place-foot-at-knee`: working ankle-to-supporting-knee distance above 0.32 torso lengths.
- `retire-open-working-knee`: working knee lateral offset below 0.28 torso lengths with adequate visibility; describe only the visible knee placement.
- `retire-keep-pelvis-level`: absolute pelvis slope above 8 degrees.
- `retire-stack-over-support`: supporting ankle-under-hip offset above 0.18 torso lengths.

Suppress `retire-open-working-knee` when the frontal camera-view check is not confirmed.

- [ ] **Step 5: Verify both rule packs**

Run: `pnpm test -- src/rules/attitudeRules.test.ts src/rules/retireRules.test.ts`  
Expected: acceptable fixtures avoid false stability/structure findings; common-error fixtures return the listed rule IDs; left/right mirrored fixtures match.

- [ ] **Step 6: Commit both rule packs**

```bash
git add src/rules/attitudeRules.ts src/rules/attitudeRules.test.ts src/rules/retireRules.ts src/rules/retireRules.test.ts tests/fixtures/attitude-*.json tests/fixtures/retire-*.json
git commit -m "feat: add attitude and retire assessment rules"
```

---

### Task 9: Confidence-Aware Feedback and Full-Body Review

**Files:**
- Create: `src/feedback/copy.ts`
- Create: `src/feedback/composeFeedback.ts`
- Create: `src/feedback/composeFeedback.test.ts`
- Create: `src/ui/Disclaimer.tsx`

**Interfaces:**
- Consumes: structured `Observation[]` and per-region `AssessmentCoverage`.
- Produces: `composeFeedback(observations, coverage): FeedbackSummary` with `topCorrections` and `fullBodyReview`.

- [ ] **Step 1: Write failing prioritisation and confidence tests**

```ts
it('orders stability before structure before line and returns at most three', () => {
  const summary = composeFeedback([lineIssue, structureIssue, stabilityIssue, secondLineIssue], allRegionsAssessable);
  expect(summary.topCorrections.map((item) => item.priority)).toEqual(['stability', 'structure', 'line']);
});

it('qualifies medium confidence and withholds low confidence', () => {
  const summary = composeFeedback([mediumPelvisIssue, lowShoulderIssue], allRegionsAssessable);
  expect(summary.topCorrections[0]?.text).toMatch(/may|appears to/i);
  expect(summary.topCorrections.some((item) => item.observationId === lowShoulderIssue.id)).toBe(false);
});
```

- [ ] **Step 2: Run the tests and verify failure**

Run: `pnpm test -- src/feedback/composeFeedback.test.ts`  
Expected: FAIL because the composer is missing.

- [ ] **Step 3: Implement approved copy templates**

Create a complete `ruleId`-keyed copy map. Each entry has direct and qualified variants:

```ts
export const FEEDBACK_COPY = {
  'supporting-knee-bent': {
    high: 'Straighten your supporting knee.',
    medium: 'Your supporting knee appears slightly bent; try lengthening it.',
  },
  'pelvis-unlevel': {
    high: 'Level your pelvis before increasing the leg height.',
    medium: 'Your pelvis may be lifting on the working side; try bringing it level.',
  },
  'shoulders-unlevel': {
    high: 'Lower the raised shoulder slightly.',
    medium: 'One shoulder appears higher; soften it downward.',
  },
  'torso-off-support': {
    high: 'Bring your torso back over your supporting side.',
    medium: 'Your torso appears slightly off your supporting side; bring it back toward centre.',
  },
  'supporting-ankle-not-stacked': {
    high: 'Stack your supporting hip more directly over your ankle.',
    medium: 'Your supporting hip may be drifting away from your ankle; bring them closer into line.',
  },
  'left-arm-line-collapsed': {
    high: 'Lengthen through your left elbow to restore the arm line.',
    medium: 'Your left elbow appears compressed; lengthen gently through the arm.',
  },
  'right-arm-line-collapsed': {
    high: 'Lengthen through your right elbow to restore the arm line.',
    medium: 'Your right elbow appears compressed; lengthen gently through the arm.',
  },
  'head-extreme-lateral-tilt': {
    high: 'Bring your head closer to the line of your torso.',
    medium: 'Your head appears strongly tilted; bring it slightly closer to your torso line.',
  },
  'arabesque-working-knee-bent': {
    high: 'Lengthen and straighten your working leg.',
    medium: 'Your working knee appears slightly bent; lengthen through the leg.',
  },
  'arabesque-lower-leg-for-pelvis': {
    high: 'Lower your working leg slightly and re-level your pelvis.',
    medium: 'Your pelvis may be lifting with the leg; lower the leg slightly and re-level it.',
  },
  'arabesque-working-leg-too-low': {
    high: 'Lengthen your working leg back and slightly upward without changing your pelvis.',
    medium: 'Your working leg may be dropping; reach it back and slightly upward while keeping the pelvis level.',
  },
  'arabesque-torso-collapse': {
    high: 'Lengthen your torso forward and upward.',
    medium: 'Your torso appears compressed; lengthen forward and upward.',
  },
  'attitude-working-knee-too-straight': {
    high: 'Soften your working knee into a clearer attitude shape.',
    medium: 'Your working knee appears nearly straight; soften it into the attitude shape.',
  },
  'attitude-working-knee-too-closed': {
    high: 'Open the angle behind your working knee slightly.',
    medium: 'The angle behind your working knee may be too closed; open it slightly.',
  },
  'attitude-level-pelvis': {
    high: 'Lower your working leg slightly and level your pelvis.',
    medium: 'Your pelvis may be lifting with the thigh; lower the leg slightly and re-level it.',
  },
  'attitude-lift-thigh': {
    high: 'Lift your working thigh slightly while keeping your pelvis level.',
    medium: 'Your working thigh appears low; lift it slightly without changing the pelvis.',
  },
  'retire-place-foot-at-knee': {
    high: 'Bring your working foot closer to the supporting knee.',
    medium: 'Your working foot appears away from the supporting knee; bring it closer.',
  },
  'retire-open-working-knee': {
    high: 'Move your working knee farther to the side without shifting your pelvis.',
    medium: 'Your working knee may be too far forward; move it slightly farther to the side.',
  },
  'retire-keep-pelvis-level': {
    high: 'Level your pelvis over the supporting leg.',
    medium: 'Your pelvis appears uneven; bring it closer to level over the supporting leg.',
  },
  'retire-stack-over-support': {
    high: 'Bring your pelvis more directly over your supporting ankle.',
    medium: 'Your balance may be drifting from the supporting ankle; bring your pelvis toward it.',
  },
} satisfies Record<string, { high: string; medium: string }>;
```

Keep entries for every rule ID introduced in Tasks 6–8 exactly centralised in this map. A missing copy entry is a thrown development error and a build-time test failure, never silently generated text.

- [ ] **Step 4: Implement Top 3 and full-body review selection**

Define coverage explicitly and pass it into the composer:

```ts
export type AssessmentCoverage = Readonly<Record<BodyRegion, 'assessable' | 'unassessable'>>;

export interface FeedbackSummary {
  topCorrections: readonly FeedbackItem[];
  fullBodyReview: readonly FullBodySection[];
}

export function composeFeedback(
  observations: readonly Observation[],
  coverage: AssessmentCoverage,
): FeedbackSummary;
```

Sort by priority category, then descending severity stored in the observation, then stable rule ID. Exclude low-confidence and unassessable observations from Top 3. For each body region, full-body review returns one of:

- actionable high/medium-confidence findings;
- `No visible issue found in this view.` when assessable with no triggered rule;
- `Unable to assess this area from the current image.` when unassessable.

Render the disclaimer: `This feedback supports practice and does not replace guidance from a qualified ballet teacher.`

- [ ] **Step 5: Verify copy coverage and forbidden language**

Add a test that enumerates every exported rule and confirms both copy variants exist. Add a word-boundary test rejecting `pain`, `injury`, `diagnose`, `engage your`, numeric degree symbols, and percentages in user-facing copy.

Run: `pnpm test -- src/feedback && pnpm build`  
Expected: prioritisation, copy coverage, uncertainty, and safety-copy tests pass.

- [ ] **Step 6: Commit feedback generation**

```bash
git add src/feedback src/ui/Disclaimer.tsx
git commit -m "feat: compose prioritised ballet feedback"
```

---

### Task 10: Joint Annotation and Downloadable Result Image

**Files:**
- Create: `src/annotation/buildCommands.ts`
- Create: `src/annotation/buildCommands.test.ts`
- Create: `src/annotation/drawAnnotatedPose.ts`
- Create: `src/annotation/drawAnnotatedPose.test.ts`
- Create: `src/annotation/renderDownload.ts`
- Create: `src/annotation/renderDownload.test.ts`

**Interfaces:**
- Consumes: source image, named landmarks, Top 3 feedback, annotation metadata, and `DrawingCommand` from Task 1.
- Produces: `buildAnnotationCommands`, `drawAnnotatedPose`, and `renderDownload(result): Promise<Blob>`.

- [ ] **Step 1: Write command-generation tests**

```ts
it('links a supporting-knee correction to the selected-side hip, knee, and ankle', () => {
  const commands = buildAnnotationCommands([supportingKneeObservation], landmarks, 'left');
  expect(commands).toEqual(expect.arrayContaining([
    expect.objectContaining({ type: 'highlight-joint', joint: 'left-knee' }),
    expect.objectContaining({ type: 'direction-arrow', anchor: 'left-knee' }),
  ]));
});
```

- [ ] **Step 2: Run the annotation test and verify failure**

Run: `pnpm test -- src/annotation/buildCommands.test.ts`  
Expected: FAIL because the command builder is missing.

- [ ] **Step 3: Implement semantic drawing commands**

```ts
const command: DrawingCommand = {
  type: 'highlight-joint',
  observationId: 'obs-supporting-knee',
  joint: 'left-knee',
  label: 1,
};
```

Only Top 3 observations receive numbered highlights. Use a neutral rose skeleton, high-contrast correction circles, arrowheads, and the same numbers as the written list. Every colour-coded mark also has a number or shape.

- [ ] **Step 4: Implement and test Canvas rendering**

Scale coordinates from normalised landmarks into the image's actual dimensions. Preserve aspect ratio, set line widths relative to the shorter dimension, and render at the source image resolution capped to 4096 pixels on the longest side. Unit-test coordinate transforms using a recording `CanvasRenderingContext2D` stub.

- [ ] **Step 5: Render one downloadable PNG containing image and feedback**

`renderDownload()` creates a new canvas with the annotated image above a rose-tinted text area containing the position name, the numbered Top 3 corrections, the practice-assistant disclaimer, and generation date. Wrap text by measured width and return `canvas.toBlob('image/png')`, rejecting when `toBlob` returns `null`.

- [ ] **Step 6: Verify drawing and download output**

Run: `pnpm test -- src/annotation && pnpm build`  
Expected: coordinate, command, null-blob, and text-wrap tests pass; no drawing routine mutates landmark input.

- [ ] **Step 7: Commit annotations and download**

```bash
git add src/annotation
git commit -m "feat: render annotated downloadable feedback"
```

---

### Task 11: End-to-End Analysis Pipeline and Result Card

**Files:**
- Create: `src/pipeline/analyzePose.ts`
- Create: `src/pipeline/analyzePose.test.ts`
- Create: `src/ui/SelectCard.tsx`
- Create: `src/ui/SelectCard.test.tsx`
- Create: `src/ui/ResultCard.tsx`
- Create: `src/ui/ResultCard.test.tsx`
- Modify: `src/app/App.tsx`
- Modify: `src/app/app.css`

**Interfaces:**
- Consumes: detector, quality gate, measurements, rules, feedback, and annotation modules from Tasks 3–10.
- Produces: `analyzePose(request, services): Promise<AnalysisOutcome>` and the complete four-stage user flow.

- [ ] **Step 1: Write a failing orchestration test using an injected fake detector**

```ts
it('runs quality before rules and returns feedback tied to annotations', async () => {
  const outcome = await analyzePose(validArabesqueRequest, {
    detector: fakeDetectorReturning(bentKneeLandmarks),
    now: () => '2026-09-03T12:00:00.000Z',
  });
  expect(outcome.status).toBe('success');
  if (outcome.status === 'success') {
    const firstMarkedCommand = outcome.result.annotations.find((command) => 'observationId' in command);
    expect(outcome.result.topCorrections[0]?.observationId).toBe(firstMarkedCommand?.observationId);
  }
});

it('returns retake reasons and never evaluates rules when quality fails', async () => {
  const evaluate = vi.fn();
  const outcome = await analyzePose(invalidRequest, { detector: noPersonDetector, evaluate });
  expect(outcome.status).toBe('retake');
  expect(evaluate).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the pipeline tests and verify failure**

Run: `pnpm test -- src/pipeline/analyzePose.test.ts`  
Expected: FAIL because `analyzePose` is missing.

- [ ] **Step 3: Implement the orchestration contract**

```ts
export type AnalysisOutcome =
  | { status: 'retake'; quality: QualityReport }
  | { status: 'success'; quality: QualityReport; result: AnalysisResult }
  | { status: 'error'; message: 'Analysis could not be completed. Please try again.' };
```

The order is decode → pixel metrics → pose detection → quality gate → measurements → selected rule pack → feedback → annotation commands. Catch model and canvas errors at the boundary, preserve the selected position and file for retry, and never fabricate a result after failure.

- [ ] **Step 4: Implement position selection and result presentation**

`SelectCard` exposes the three approved positions and left/right supporting side as native radio groups. `ResultCard` renders:

- annotated image with meaningful alt text;
- exactly three numbered corrections when three assessable issues exist, otherwise the available one or two without filler;
- an expandable `<details>` full-body review;
- the teacher disclaimer;
- `Download result` using the combined PNG from Task 10;
- `Analyse another photo`, which disposes decoded images and resets the session.

- [ ] **Step 5: Wire the complete App with injectable services**

```ts
export interface AppServices {
  createDetector(): Promise<PoseDetector>;
  now(): string;
}

export function App({ services = browserServices }: { services?: AppServices }) {
  // reducer-driven composition; only the active card is mounted
}
```

Initialise MediaPipe lazily after a valid file is selected, show a textual progress state during analysis, close the detector on app unmount, and revoke all photo URLs on reset.

- [ ] **Step 6: Verify the integrated flow with component tests**

Run: `pnpm test -- src/pipeline src/ui src/session && pnpm build`  
Expected: a fake-detector flow moves Select → Frame → Check → Result, a failed quality report remains at Check, changing position invalidates results, and only one stage card is present in the document at any time.

- [ ] **Step 7: Commit the complete product flow**

```bash
git add src/pipeline src/ui src/app
git commit -m "feat: connect ballet analysis experience"
```

---

### Task 12: Evaluation Harness, Privacy Checks, Accessibility, and Release Verification

**Files:**
- Create: `evaluation/dataset.schema.ts`
- Create: `evaluation/scoreAgreement.ts`
- Create: `evaluation/scoreAgreement.test.ts`
- Create: `evaluation/README.md`
- Create: `playwright.config.ts`
- Create: `tests/e2e/mobile-flow.spec.ts`
- Create: `README.md`
- Modify: `package.json`

**Interfaces:**
- Consumes: final rule IDs and `AnalysisResult` output.
- Produces: `scoreAgreement(cases): AgreementReport`, mobile end-to-end tests, and an exact owner-review workflow.

- [ ] **Step 1: Write the failing human-agreement metric tests**

```ts
it('counts a photo as matched when two of three region-and-direction pairs agree', () => {
  const report = scoreAgreement([caseWithTwoMatches]);
  expect(report).toEqual({ assessableCount: 1, matchedCount: 1, rate: 1, passesTarget: true });
});

it('uses 80 percent as the release target', () => {
  const report = scoreAgreement(eightMatchingCasesAndTwoFailures);
  expect(report.rate).toBe(0.8);
  expect(report.passesTarget).toBe(true);
});
```

- [ ] **Step 2: Run the metric tests and verify failure**

Run: `pnpm test -- evaluation/scoreAgreement.test.ts`  
Expected: FAIL because the scorer is missing.

- [ ] **Step 3: Implement the labelled dataset schema and scorer**

```ts
export const labelledCaseSchema = z.object({
  id: z.string().min(1),
  position: z.enum(['arabesque', 'attitude-derriere', 'retire-passe']),
  supportingSide: z.enum(['left', 'right']),
  assessable: z.boolean(),
  expectedTop3: z.array(z.object({
    region: bodyRegionSchema,
    direction: z.string().min(1),
  })).max(3),
  actualTop3: z.array(z.object({
    region: bodyRegionSchema,
    direction: z.string().min(1),
  })).max(3),
});
```

Match only exact region and normalised direction codes, not prose. Exclude cases labelled unassessable from the primary denominator and report their quality-gate accuracy separately.

- [ ] **Step 4: Document the real-photo review protocol**

`evaluation/README.md` instructs the product owner to:

1. collect owned or explicitly licensed photos across all three positions;
2. include acceptable, common-error, large-deviation, crop, occlusion, lighting, view, and multi-person cases;
3. label assessability and up to three region/direction corrections before viewing system output;
4. run the app and record actual structured output;
5. execute the scorer;
6. require at least two Top 3 matches on at least 80% of assessable photos;
7. record teacher-reviewed replacement labels in a later calibration round.

State explicitly that automated synthetic fixtures prove rule behavior but cannot satisfy the human-agreement release criterion.

- [ ] **Step 5: Add phone-sized Playwright and accessibility tests**

Configure projects for a 390-by-844 Chromium viewport and Mobile Safari emulation. Inject fake services at component boundaries rather than loading personal photos. Test:

```ts
test('shows only one stage card and supports keyboard tab navigation', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('main.app-card > section:visible')).toHaveCount(1);
  await page.getByRole('tab', { name: 'Frame' }).press('Enter');
  await expect(page.getByRole('heading', { name: 'Frame your pose' })).toBeVisible();
});

test('has no serious accessibility violations', async ({ page }) => {
  await page.goto('/');
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? ''))).toEqual([]);
});
```

Add a browser test that replaces `window.localStorage.setItem`, `indexedDB.open`, and `fetch` with spies after model assets load; selecting and analysing a fixture must not persist data or send a POST request.

- [ ] **Step 6: Add project usage and safety documentation**

`README.md` includes prerequisites, `pnpm install`, `pnpm dev`, `pnpm test`, `pnpm test:e2e`, model-asset source, supported positions/views, privacy behavior, safety limits, and the real-photo acceptance gate. It states that the numerical thresholds are initial engineering values requiring product-owner and teacher calibration.

- [ ] **Step 7: Run the complete release verification**

Run:

```bash
pnpm test
pnpm build
pnpm exec playwright install chromium webkit
pnpm test:e2e
git status --short
```

Expected: all unit/component tests pass; the production build succeeds; Chromium and WebKit phone tests pass; no raw image fixture or generated MediaPipe asset is tracked; only the intended plan or documentation files remain uncommitted before the final commit.

- [ ] **Step 8: Commit evaluation and release safeguards**

```bash
git add evaluation playwright.config.ts tests/e2e README.md package.json pnpm-lock.yaml
git commit -m "test: add ballet feedback release checks"
```

---

## Final Acceptance Gate

Engineering completion requires all automated checks in Task 12 to pass. Product acceptance additionally requires the product owner's real-photo dataset to meet the approved criterion: on at least 80% of assessable photos, at least two of the system's Top 3 corrections agree with human review on both body region and adjustment direction. Until that dataset is labelled and scored, report the application as an implemented MVP candidate rather than a validated coaching tool.

## Official Implementation References

- Vite Getting Started: https://vite.dev/guide/
- MediaPipe Pose Landmarker overview and model documentation: https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker
- MediaPipe BlazePose GHUM model card: https://storage.googleapis.com/mediapipe-assets/Model%20Card%20BlazePose%20GHUM%203D.pdf
- Playwright installation and mobile projects: https://playwright.dev/docs/intro
- Vitest browser and React testing guidance: https://vitest.dev/api/browser/react

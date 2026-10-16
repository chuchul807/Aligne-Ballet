# ALIGNÉ Native iPhone App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a native SwiftUI iPhone app that reproduces the website's five-position, single-photo ALIGNÉ analysis locally on iPhone 13 and newer devices running iOS 16 or later.

**Architecture:** Keep the web app unchanged and add an independent Xcode project under `ios/AligneBallet`. Port the deterministic TypeScript domain pipeline to testable Swift types, connect it to MediaPipe Tasks Vision image-mode inference, then place a four-stage SwiftUI flow over that core.

**Tech Stack:** SwiftUI, Swift 5 language mode, XCTest, XCUITest, Core Graphics, PhotosUI, AVFoundation, PhotoKit, MediaPipeTasksVision 1.1.0 through Swift Package Manager, existing TypeScript/Vitest parity fixtures.

**Spec:** `docs/superpowers/specs/2026-10-15-ios-native-app-design.md`

## Global Constraints

- Minimum deployment target is iOS 16.0; supported hardware starts at iPhone 13; the first release is iPhone-only and portrait-only.
- Use the existing `pose_landmarker_heavy.task`, image mode, `numPoses = 2`, and detection/presence thresholds of `0.5`.
- Preserve the current two-pass detection, image limits, reliability thresholds, measurements, five position rule sets, deduplication, and Top 3 behavior.
- Do not change the current website behavior, ballet thresholds, English feedback meaning, deployment, or production assets.
- Process photos locally; do not add accounts, networking, analytics, stored history, or automatic photo persistence.
- Support English and Simplified Chinese through String Catalog; the system language chooses the language.
- Use `PhotosPicker` for library input so read access to the whole photo library is unnecessary; request camera and add-only photo permissions only when needed.
- Keep `DEVELOPMENT_TEAM` user-local and out of version control. Use bundle identifier `online.aligneballet.app`.
- Before Task 1, the human partner must open Xcode, accept Apple's license, install requested components, and create an available simulator named `Aligne Tests`. Device signing requires selecting their own Personal Team in Xcode.

## Review Focus

- EXIF rotations and mirrored source photos must use one upright pixel coordinate system for preview, detection, crop, measurement, and annotation; Task 3 pins this with orientation tests.
- Replacing a photo or leaving the flow during analysis must prevent a late result from overwriting the new state; Task 8 pins this with cancellation-generation tests.
- Zero people, multiple people, and unreliable key joints must produce a localized retake state instead of a crash or generic technical error; Task 7 pins all three outcomes.
- Invalid, undersized, oversized, or memory-failing image input must release intermediates and return an actionable error; Tasks 3 and 7 pin validation and error mapping.
- Denying camera or add-to-library permission must preserve the selected/result state and offer a Settings route; Tasks 8 and 9 pin both permission paths.

## Target File Map

- `ios/AligneBallet/AligneBallet.xcodeproj/`: shared app, unit-test, and UI-test schemes; iOS 16 deployment and iPhone-only settings.
- `ios/AligneBallet/AligneBallet/App/`: app entry point, dependency assembly, session store, root flow.
- `ios/AligneBallet/AligneBallet/Domain/`: Codable value types and stable enum identifiers shared by all layers.
- `ios/AligneBallet/AligneBallet/Analysis/`: geometry, measurements, reliability, image quality, crop, and agreement.
- `ios/AligneBallet/AligneBallet/Rules/`: generic rule engine plus common and five position-specific rule sets.
- `ios/AligneBallet/AligneBallet/Feedback/`: deduplication, prioritization, and localized feedback lookup.
- `ios/AligneBallet/AligneBallet/Annotation/`: deterministic drawing commands and Core Graphics rendering.
- `ios/AligneBallet/AligneBallet/PoseDetection/`: MediaPipe adapter and model loading only.
- `ios/AligneBallet/AligneBallet/Image/`: photo decoding, orientation normalization, resizing, metrics, and crops.
- `ios/AligneBallet/AligneBallet/Pipeline/`: injected asynchronous orchestration and outcome mapping.
- `ios/AligneBallet/AligneBallet/Features/`: Select, Frame, Check, Result views plus camera/photo/save adapters.
- `ios/AligneBallet/AligneBallet/Resources/`: asset catalog, String Catalog, privacy strings, and ignored generated model resource.
- `ios/AligneBallet/AligneBalletTests/`: focused unit and integration tests; shared JSON fixtures are added as test resources.
- `ios/AligneBallet/AligneBalletUITests/`: launch-argument-controlled UI flows and localization checks.
- `tests/fixtures/ios-domain-parity.json`: committed platform-neutral inputs and expected deterministic outputs.
- `scripts/sync-ios-pose-model.mjs`: verifies and copies the Heavy model into the ignored iOS resource location.

---

### Task 1: Xcode Project and Domain Contracts

**Files:**
- Create: `ios/AligneBallet/AligneBallet.xcodeproj/`
- Create: `ios/AligneBallet/AligneBallet/App/AligneBalletApp.swift`
- Create: `ios/AligneBallet/AligneBallet/App/RootView.swift`
- Create: `ios/AligneBallet/AligneBallet/Domain/LandmarkTypes.swift`
- Create: `ios/AligneBallet/AligneBallet/Domain/AnalysisTypes.swift`
- Create: `ios/AligneBallet/AligneBalletTests/DomainTypesTests.swift`
- Create: `ios/AligneBallet/AligneBalletUITests/LaunchTests.swift`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: identifiers and shapes from `src/domain/landmarks.ts` and `src/domain/types.ts`.
- Produces: `PoseName`, `SupportingSide`, `ViewType`, `Confidence`, `Assessability`, `Priority`, `BodyRegion`, `AnalysisStage`, `LandmarkName`, `Landmark`, `LandmarkSet`, `LandmarkReliability`, `PoseMeasurement`, `MeasurementSet`, `Observation`, `DrawingCommand`, `QualityReasonCode`, `QualityReport`, `AnalysisResult`, and `PixelSize`, all `Equatable` and `Sendable`; persisted fixture types also conform to `Codable`.

- [ ] **Step 1: Create the Xcode project shell**

In Xcode create an iOS App named `AligneBallet` with SwiftUI lifecycle, Swift language, unit tests, and UI tests. Set bundle ID `online.aligneballet.app`, deployment `16.0`, target family iPhone, portrait-only orientations, and share the `AligneBallet` scheme. Leave signing team unset in committed settings.

- [ ] **Step 2: Write failing domain and launch tests**

Add tests named `testLandmarkDecodesAllThirtyThreeNames`, `testAnalysisResultRoundTripsThroughJSON`, and `testAppLaunchesAtSelectStage`. Assert raw values exactly match the TypeScript identifiers, including accented display labels remaining outside the enums.

- [ ] **Step 3: Run the focused tests and confirm failure**

Run: `xcodebuild -project ios/AligneBallet/AligneBallet.xcodeproj -scheme AligneBallet -destination 'platform=iOS Simulator,name=Aligne Tests' -only-testing:AligneBalletTests/DomainTypesTests test`

Expected: FAIL because the Swift domain types do not exist.

- [ ] **Step 4: Implement the domain contracts and minimal root view**

Use `Double` for normalized coordinates and measurements. Make `Landmark.z` and `Landmark.presence` optional. Model `Observation` with one struct containing nullable issue/action/direction/severity plus an initializer that enforces unassessable observations have low confidence and nil finding fields.

- [ ] **Step 5: Run unit and launch tests**

Run: `xcodebuild -project ios/AligneBallet/AligneBallet.xcodeproj -scheme AligneBallet -destination 'platform=iOS Simulator,name=Aligne Tests' -only-testing:AligneBalletTests/DomainTypesTests test`

Run: `xcodebuild -project ios/AligneBallet/AligneBallet.xcodeproj -scheme AligneBallet -destination 'platform=iOS Simulator,name=Aligne Tests' -only-testing:AligneBalletUITests/LaunchTests test`

Expected: both commands PASS; app opens to the minimal Select stage.

- [ ] **Step 6: Commit**

```bash
git add .gitignore ios/AligneBallet
git commit -m "feat: scaffold native iPhone app"
```

### Task 2: Shared Parity Fixture, Geometry, and Measurements

**Files:**
- Create: `tests/fixtures/ios-domain-parity.json`
- Create: `src/analysis/iosDomainParity.test.ts`
- Create: `ios/AligneBallet/AligneBallet/Analysis/Geometry.swift`
- Create: `ios/AligneBallet/AligneBallet/Analysis/PoseMeasurer.swift`
- Create: `ios/AligneBallet/AligneBalletTests/GeometryTests.swift`
- Create: `ios/AligneBallet/AligneBalletTests/PoseMeasurerTests.swift`

**Interfaces:**
- Consumes: Task 1 domain types and formulas in `src/analysis/geometry.ts` and `src/analysis/measurePose.ts`.
- Produces: `Geometry.distance`, `midpoint`, `angleDegrees`, `slopeDegrees`, `normalizedDistance`; `PoseMeasurer.measure(landmarks:supportingSide:reliability:view:sourceSize:) -> MeasurementSet`.

- [ ] **Step 1: Add the platform-neutral fixture and Web assertion**

Include left/right support, front/three-quarter views, missing evidence, degenerate geometry, foot depth, knee depth, arm, head, and every `MeasurementSet` field. `iosDomainParity.test.ts` loads the JSON, runs the existing TypeScript functions, and asserts the committed expected values within `0.000001`.

- [ ] **Step 2: Run the Web fixture test**

Run: `pnpm test -- src/analysis/iosDomainParity.test.ts`

Expected: PASS, proving the fixture represents the existing website behavior before Swift is written.

- [ ] **Step 3: Write failing Swift geometry and measurement tests**

Load the same JSON as an Xcode test resource. Add `testGeometryMatchesWebFixtureWithinOneEMinusSix`, `testEveryMeasurementMatchesWebFixture`, and `testMissingEvidenceIsUnassessable`.

- [ ] **Step 4: Run and confirm failure**

Run: `xcodebuild -project ios/AligneBallet/AligneBallet.xcodeproj -scheme AligneBallet -destination 'platform=iOS Simulator,name=Aligne Tests' -only-testing:AligneBalletTests/GeometryTests -only-testing:AligneBalletTests/PoseMeasurerTests test`

Expected: FAIL because `Geometry` and `PoseMeasurer` do not exist.

- [ ] **Step 5: Port geometry and measurement logic without threshold changes**

Keep view-specific unsupported measurements unassessable and derive confidence from the lowest-confidence evidence exactly as the TypeScript implementation does.

- [ ] **Step 6: Run Web and Swift tests**

Run: `pnpm test -- src/analysis/iosDomainParity.test.ts`

Run: `xcodebuild -project ios/AligneBallet/AligneBallet.xcodeproj -scheme AligneBallet -destination 'platform=iOS Simulator,name=Aligne Tests' -only-testing:AligneBalletTests/GeometryTests -only-testing:AligneBalletTests/PoseMeasurerTests test`

Expected: both commands PASS and every deterministic numeric comparison is within `0.000001`.

- [ ] **Step 7: Commit**

```bash
git add tests/fixtures/ios-domain-parity.json src/analysis/iosDomainParity.test.ts ios/AligneBallet
git commit -m "feat: port pose measurements to Swift"
```

### Task 3: Image Decoding, Orientation, Resizing, and Metrics

**Files:**
- Create: `ios/AligneBallet/AligneBallet/Image/NormalizedImage.swift`
- Create: `ios/AligneBallet/AligneBallet/Image/ImageNormalizer.swift`
- Create: `ios/AligneBallet/AligneBallet/Image/ImageMetricsCalculator.swift`
- Create: `ios/AligneBallet/AligneBalletTests/ImageNormalizerTests.swift`
- Create: `ios/AligneBallet/AligneBalletTests/ImageMetricsTests.swift`

**Interfaces:**
- Consumes: Task 1 `PixelSize`; constants and behavior from `src/image/normaliseImage.ts`, `decodeImage.ts`, `validateImageFile.ts`, and `imageMetrics.ts`.
- Produces: `NormalizedImage(cgImage:originalSize:wasResized:)`; `ImageNormalizer.normalize(data:) throws -> NormalizedImage`; `ImageMetricsCalculator.calculate(image:) throws -> ImageMetrics`; `ImageInputError` cases with localized-key payloads.

- [ ] **Step 1: Write failing normalization tests**

Add `testRejectsShortestSideBelow480`, `testResizesLongestSideAbove4096WithoutUpscaling`, `testAppliesEXIFRightRotationBeforeReportingSize`, `testRemovesMirroredOrientationFromPixelSpace`, `testRejectsInvalidData`, and `testMapsRendererAllocationFailureWithoutRetainingInput` using generated images and an injected failing renderer.

- [ ] **Step 2: Write failing metric tests**

Port the existing solid, dark, low-contrast, and normal synthetic pixel cases from `src/image/imageMetrics.test.ts`.

- [ ] **Step 3: Run and confirm failure**

Run: `xcodebuild -project ios/AligneBallet/AligneBallet.xcodeproj -scheme AligneBallet -destination 'platform=iOS Simulator,name=Aligne Tests' -only-testing:AligneBalletTests/ImageNormalizerTests -only-testing:AligneBalletTests/ImageMetricsTests test`

Expected: FAIL with missing `ImageNormalizer` and `ImageMetricsCalculator` symbols.

- [ ] **Step 4: Implement normalization and metrics**

Set exact limits `MIN_IMAGE_SIDE = 480` and `MAX_ANALYSIS_SIDE = 4096`. Render orientation once into an upright, non-mirrored `CGImage`; all later stages must use that image and its pixel dimensions.

- [ ] **Step 5: Run focused tests and an Address Sanitizer test pass**

Run: `xcodebuild -project ios/AligneBallet/AligneBallet.xcodeproj -scheme AligneBallet -destination 'platform=iOS Simulator,name=Aligne Tests' -only-testing:AligneBalletTests/ImageNormalizerTests -only-testing:AligneBalletTests/ImageMetricsTests test`

Run: `xcodebuild -project ios/AligneBallet/AligneBallet.xcodeproj -scheme AligneBallet -destination 'platform=iOS Simulator,name=Aligne Tests' -enableAddressSanitizer YES -only-testing:AligneBalletTests/ImageNormalizerTests -only-testing:AligneBalletTests/ImageMetricsTests test`

Expected: both commands PASS with no sanitizer report.

- [ ] **Step 6: Commit**

```bash
git add ios/AligneBallet
git commit -m "feat: normalize iPhone photo input"
```

### Task 4: Reliability, Focus Crop, Agreement, and Quality Gates

**Files:**
- Create: `ios/AligneBallet/AligneBallet/Analysis/LandmarkReliabilityEvaluator.swift`
- Create: `ios/AligneBallet/AligneBallet/Analysis/FocusedCrop.swift`
- Create: `ios/AligneBallet/AligneBallet/Analysis/PoseAgreement.swift`
- Create: `ios/AligneBallet/AligneBallet/Analysis/QualityEvaluator.swift`
- Create: `ios/AligneBallet/AligneBalletTests/LandmarkReliabilityTests.swift`
- Create: `ios/AligneBallet/AligneBalletTests/FocusedCropTests.swift`
- Create: `ios/AligneBallet/AligneBalletTests/PoseAgreementTests.swift`
- Create: `ios/AligneBallet/AligneBalletTests/QualityEvaluatorTests.swift`

**Interfaces:**
- Consumes: Tasks 1–3 types and behavior from the matching TypeScript modules.
- Produces: `LandmarkReliabilityEvaluator.evaluate(landmarks:view:disagreements:) -> [LandmarkName: LandmarkReliability]`; `FocusedCrop.assessSubjectSize(landmarks:sourceSize:) -> SubjectSizeAssessment`; `FocusedCrop.calculateRect(landmarks:sourceSize:) -> CropRect?`; `FocusedCrop.mapLandmarks(_:from:sourceSize:) -> [Landmark]`; `FocusedCrop.crop(image:rect:) throws -> CGImage`; `PoseAgreement.compare(whole:refined:sourceSize:) -> Set<LandmarkName>`; `QualityEvaluator.evaluate(_ input: QualityInput) -> QualityReport`.

- [ ] **Step 1: Port the existing synthetic tests as failing Swift tests**

Pin `0.60` visibility/presence, `48` torso pixels, `180` body-extent pixels, `0.20` padding, `0.12` major-joint disagreement, and `0.18` flexible-joint disagreement. Include out-of-frame, implausible-chain, occlusion, zero-person, multi-person, wrong-view, and unavailable-region cases.

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `xcodebuild -project ios/AligneBallet/AligneBallet.xcodeproj -scheme AligneBallet -destination 'platform=iOS Simulator,name=Aligne Tests' -only-testing:AligneBalletTests/LandmarkReliabilityTests -only-testing:AligneBalletTests/FocusedCropTests -only-testing:AligneBalletTests/PoseAgreementTests -only-testing:AligneBalletTests/QualityEvaluatorTests test`

Expected: FAIL with missing evaluator and crop symbols.

- [ ] **Step 3: Implement reliability and crop mapping**

Use normalized landmark coordinates and `PixelSize`; clamp crop rectangles to image bounds and map refined landmarks back to the full normalized image coordinate system.

- [ ] **Step 4: Implement agreement and quality evaluation**

Return disagreements as landmark identifiers so later pipeline stages can suppress the same regions as the website.

- [ ] **Step 5: Run Tasks 2–4 tests together**

Run: `xcodebuild -project ios/AligneBallet/AligneBallet.xcodeproj -scheme AligneBallet -destination 'platform=iOS Simulator,name=Aligne Tests' -only-testing:AligneBalletTests/GeometryTests -only-testing:AligneBalletTests/PoseMeasurerTests -only-testing:AligneBalletTests/ImageNormalizerTests -only-testing:AligneBalletTests/ImageMetricsTests -only-testing:AligneBalletTests/LandmarkReliabilityTests -only-testing:AligneBalletTests/FocusedCropTests -only-testing:AligneBalletTests/PoseAgreementTests -only-testing:AligneBalletTests/QualityEvaluatorTests test`

Expected: PASS with no regressions in geometry or measurements.

- [ ] **Step 6: Commit**

```bash
git add ios/AligneBallet
git commit -m "feat: port pose reliability and quality gates"
```

### Task 5: Five Rule Sets, Feedback, and Localization Keys

**Files:**
- Create: `ios/AligneBallet/AligneBallet/Rules/Rule.swift`
- Create: `ios/AligneBallet/AligneBallet/Rules/RuleEngine.swift`
- Create: `ios/AligneBallet/AligneBallet/Rules/CommonRules.swift`
- Create: `ios/AligneBallet/AligneBallet/Rules/ArabesqueRules.swift`
- Create: `ios/AligneBallet/AligneBallet/Rules/AttitudeRules.swift`
- Create: `ios/AligneBallet/AligneBallet/Rules/RetireRules.swift`
- Create: `ios/AligneBallet/AligneBallet/Rules/ALaSecondeRules.swift`
- Create: `ios/AligneBallet/AligneBallet/Rules/TenduCroiseRules.swift`
- Create: `ios/AligneBallet/AligneBallet/Feedback/FeedbackComposer.swift`
- Create: `ios/AligneBallet/AligneBallet/Feedback/FeedbackCopy.swift`
- Create: `ios/AligneBallet/AligneBalletTests/RuleParityTests.swift`
- Create: `ios/AligneBallet/AligneBalletTests/FeedbackComposerTests.swift`

**Interfaces:**
- Consumes: `MeasurementSet`, reliability maps, and the exact configurations in `src/rules/` and `src/feedback/`.
- Produces: `RuleContext`; `Rule(id:positions:requiredMeasurements:supportedViews:evaluate:)`; `RuleEngine.evaluate(rules:context:)`; `FeedbackComposer.compose(observations:coverage:) -> FeedbackSummary`; `FeedbackCopy.key(ruleID:confidence:) -> String`.

- [ ] **Step 1: Extend the parity JSON with rule scenarios**

For every common and position-specific rule include no-finding, clear finding, boundary, unsupported-view, low-confidence, left-support, and right-support cases. Expected output stores stable rule ID, assessability, region, direction, priority, severity, and Top 3 order—not localized prose.

- [ ] **Step 2: Make TypeScript parity assertions pass**

Run: `pnpm test -- src/analysis/iosDomainParity.test.ts src/rules/evaluateRules.test.ts src/rules/deduplicateObservations.test.ts src/rules/arabesqueRules.test.ts src/rules/attitudeRules.test.ts src/rules/retireRules.test.ts src/rules/aLaSecondeRules.test.ts src/rules/tenduCroiseRules.test.ts src/feedback/composeFeedback.test.ts`

Expected: PASS before Swift implementation.

- [ ] **Step 3: Write failing Swift parity tests**

Add one parameterized test over all fixture cases plus explicit tests named `testLowConfidenceFindingIsSuppressed`, `testDeduplicationKeepsHighestPriorityFinding`, and `testFewerThanThreeCorrectionsIsValid`.

Run: `xcodebuild -project ios/AligneBallet/AligneBallet.xcodeproj -scheme AligneBallet -destination 'platform=iOS Simulator,name=Aligne Tests' -only-testing:AligneBalletTests/RuleParityTests -only-testing:AligneBalletTests/FeedbackComposerTests test`

Expected: FAIL with missing rule and feedback symbols.

- [ ] **Step 4: Port the rule engine and all six rule collections**

Copy numeric constants exactly. Rules output stable identifiers and semantic direction; no user-visible English or Chinese text belongs in rule closures.

- [ ] **Step 5: Implement feedback selection and copy-key lookup**

Preserve confidence qualification, region coverage, priority ordering, deduplication, and conservative suppression.

- [ ] **Step 6: Run all web rule tests and Swift rule tests**

Run: `pnpm test -- src/analysis/iosDomainParity.test.ts src/rules/evaluateRules.test.ts src/rules/deduplicateObservations.test.ts src/rules/arabesqueRules.test.ts src/rules/attitudeRules.test.ts src/rules/retireRules.test.ts src/rules/aLaSecondeRules.test.ts src/rules/tenduCroiseRules.test.ts src/feedback/composeFeedback.test.ts`

Run: `xcodebuild -project ios/AligneBallet/AligneBallet.xcodeproj -scheme AligneBallet -destination 'platform=iOS Simulator,name=Aligne Tests' -only-testing:AligneBalletTests/RuleParityTests -only-testing:AligneBalletTests/FeedbackComposerTests test`

Expected: both commands PASS with exact identifier/direction/order parity.

- [ ] **Step 7: Commit**

```bash
git add tests/fixtures/ios-domain-parity.json src/analysis/iosDomainParity.test.ts ios/AligneBallet
git commit -m "feat: port ballet feedback rules to Swift"
```

### Task 6: Annotation Commands and Result Rendering

**Files:**
- Create: `ios/AligneBallet/AligneBallet/Annotation/AnnotationCommandBuilder.swift`
- Create: `ios/AligneBallet/AligneBallet/Annotation/AnnotationRenderer.swift`
- Create: `ios/AligneBallet/AligneBalletTests/AnnotationCommandBuilderTests.swift`
- Create: `ios/AligneBallet/AligneBalletTests/AnnotationRendererTests.swift`

**Interfaces:**
- Consumes: selected observations, landmarks, reliability map, supporting side, and command behavior from `src/annotation/`.
- Produces: `AnnotationCommandBuilder.build(observations:landmarks:reliability:supportingSide:) -> [DrawingCommand]`; `AnnotationRenderer.render(baseImage:commands:landmarks:) throws -> UIImage`.

- [ ] **Step 1: Write failing command tests**

Cover one-to-one labels `1...3`, suppressed unreliable joints, structural segments, regions, arrows, and the case of no corrections.

- [ ] **Step 2: Write failing renderer tests**

Assert output pixel size equals input, drawing changes expected neighborhoods, source image remains unchanged, and an upright portrait input keeps annotation coordinates aligned.

- [ ] **Step 3: Run and confirm failure**

Run: `xcodebuild -project ios/AligneBallet/AligneBallet.xcodeproj -scheme AligneBallet -destination 'platform=iOS Simulator,name=Aligne Tests' -only-testing:AligneBalletTests/AnnotationCommandBuilderTests -only-testing:AligneBalletTests/AnnotationRendererTests test`

Expected: FAIL because the annotation builder and renderer do not exist.

- [ ] **Step 4: Implement command building and Core Graphics rendering**

Scale stroke width, joint radius, number labels, and arrowheads from image dimensions while preserving the web command semantics.

- [ ] **Step 5: Run focused and parity tests**

Run: `xcodebuild -project ios/AligneBallet/AligneBallet.xcodeproj -scheme AligneBallet -destination 'platform=iOS Simulator,name=Aligne Tests' -only-testing:AligneBalletTests/AnnotationCommandBuilderTests -only-testing:AligneBalletTests/AnnotationRendererTests test`

Expected: PASS; semantic commands match the shared fixture exactly.

- [ ] **Step 6: Commit**

```bash
git add ios/AligneBallet tests/fixtures/ios-domain-parity.json
git commit -m "feat: render annotated ballet results on iOS"
```

### Task 7: MediaPipe Adapter and End-to-End Analysis Pipeline

**Files:**
- Modify: `ios/AligneBallet/AligneBallet.xcodeproj/project.pbxproj`
- Create: `scripts/sync-ios-pose-model.mjs`
- Modify: `package.json`
- Modify: `.gitignore`
- Create: `ios/AligneBallet/AligneBallet/PoseDetection/PoseDetecting.swift`
- Create: `ios/AligneBallet/AligneBallet/PoseDetection/MediaPipePoseDetector.swift`
- Create: `ios/AligneBallet/AligneBallet/Pipeline/AnalysisPipeline.swift`
- Create: `ios/AligneBallet/AligneBalletTests/MediaPipePoseDetectorTests.swift`
- Create: `ios/AligneBallet/AligneBalletTests/AnalysisPipelineTests.swift`

**Interfaces:**
- Consumes: Tasks 1–6 and MediaPipe normalized/world landmark output.
- Produces: `protocol PoseDetecting { func detect(image: CGImage) async throws -> LandmarkSet }`; `MediaPipePoseDetector.init(modelURL: URL) throws`; `AnalysisRequest.init(imageData: Data, position: PoseName, supportingSide: SupportingSide, expectedView: ViewType)`; `AnalysisPipeline.analyze(_ request: AnalysisRequest) async -> AnalysisOutcome` with `.retake(QualityReport)`, `.success(AnalysisResult, UIImage)`, and `.failure(AnalysisError)`.

- [ ] **Step 1: Add official MediaPipe dependency and reproducible model sync**

Pin `https://github.com/google-ai-edge/mediapipe` to exact version `1.1.0` and add product `MediaPipeTasksVision`. The sync script copies `public/models/pose_landmarker_heavy.task` after verifying SHA-256 `64437af838a65d18e5ba7a0d39b465540069bc8aae8308de3e318aad31fcbc7b`; if absent, it downloads the same URL used by `scripts/sync-mediapipe-assets.mjs`. Ignore only the generated iOS model directory and add `pnpm sync:ios-model`.

- [ ] **Step 2: Write failing detector mapping tests**

Assert 33 landmarks, normalized `x/y/z`, visibility, presence, source size, empty results, and two-person results map without changing order.

- [ ] **Step 3: Write failing injected-pipeline tests**

Use a fake detector to cover success, zero people, two people, undersized subject, cross-pass disagreement, unavailable required region, invalid image, model load failure, and renderer allocation failure. Assert zero/two/unreliable cases are `.retake`; infrastructure failures are `.failure` with stable localization keys.

- [ ] **Step 4: Implement image-mode MediaPipe adapter**

Set `runningMode = .image`, `numPoses = 2`, `minPoseDetectionConfidence = 0.5`, and `minPosePresenceConfidence = 0.5`. Run synchronous inference away from `MainActor` and make detector ownership single-threaded.

- [ ] **Step 5: Implement the two-pass pipeline**

Follow `src/pipeline/analyzePose.ts` stage order exactly, including viability quorums, disagreement regions, selected-observation mapping, and release of crop/decoded intermediates on every outcome.

- [ ] **Step 6: Run model sync, focused tests, and a blank-image integration test**

Run: `pnpm sync:ios-model`

Run: `xcodebuild -project ios/AligneBallet/AligneBallet.xcodeproj -scheme AligneBallet -destination 'platform=iOS Simulator,name=Aligne Tests' -only-testing:AligneBalletTests/MediaPipePoseDetectorTests -only-testing:AligneBalletTests/AnalysisPipelineTests test`

Expected: both commands PASS; the actual model loads from the app/test bundle and a blank image returns zero people without crashing.

- [ ] **Step 7: Commit**

```bash
git add .gitignore package.json pnpm-lock.yaml scripts/sync-ios-pose-model.mjs ios/AligneBallet
git commit -m "feat: run native MediaPipe pose analysis"
```

### Task 8: Session Store, Select/Frame UI, Camera, and Photo Library

**Files:**
- Create: `ios/AligneBallet/AligneBallet/App/AnalysisSessionStore.swift`
- Modify: `ios/AligneBallet/AligneBallet/App/RootView.swift`
- Create: `ios/AligneBallet/AligneBallet/Features/Select/SelectView.swift`
- Create: `ios/AligneBallet/AligneBallet/Features/Frame/FrameView.swift`
- Create: `ios/AligneBallet/AligneBallet/Features/Frame/CameraPicker.swift`
- Create: `ios/AligneBallet/AligneBallet/Features/Frame/PhotoSelectionService.swift`
- Create: `ios/AligneBallet/AligneBalletTests/AnalysisSessionStoreTests.swift`
- Create: `ios/AligneBallet/AligneBalletTests/PhotoSelectionServiceTests.swift`
- Create: `ios/AligneBallet/AligneBalletUITests/SelectionAndPhotoFlowTests.swift`
- Modify: `ios/AligneBallet/AligneBallet/Info.plist`

**Interfaces:**
- Consumes: `AnalysisPipeline`, position/view mapping, and Task 1 domain state.
- Produces: `AnalysisState` with idle/loading/retake/success/failure cases; `@MainActor final class AnalysisSessionStore: ObservableObject` with `stage`, `position`, `supportingSide`, `analysisState`, `selectImage(data: Data)`, `cancelAnalysis()`, `requestStage(_ stage: AnalysisStage)`, and `reset()`; `PhotoSelectionServing.loadData(from:) async throws -> Data?`; `CameraAuthorizing.status` and `requestAccess() async -> Bool`.

- [ ] **Step 1: Write failing store tests**

Cover the four-stage transition rules, position-to-view mapping, reset, retry, and `testLateAnalysisResultCannotReplaceNewerPhoto`. Use controllable async pipeline continuations to prove generation-based cancellation.

- [ ] **Step 2: Write failing permission and photo tests**

Cover camera authorized, denied, restricted, unavailable simulator camera, PhotosPicker cancellation, invalid data, and large-image failure. Denial must keep the current stage and expose a Settings action.

- [ ] **Step 3: Implement the session store and adapters**

Use `UIImagePickerController` only for camera capture and `PhotosPicker` for library input. Add bilingual camera usage text; do not request general photo-library read permission.

- [ ] **Step 4: Build Select and Frame views**

Use native controls, website-derived colors and spacing, Dynamic Type, minimum 44-point targets, and accessibility identifiers required by UI tests.

- [ ] **Step 5: Run unit and UI tests**

Run: `xcodebuild -project ios/AligneBallet/AligneBallet.xcodeproj -scheme AligneBallet -destination 'platform=iOS Simulator,name=Aligne Tests' -only-testing:AligneBalletTests/AnalysisSessionStoreTests -only-testing:AligneBalletTests/PhotoSelectionServiceTests -only-testing:AligneBalletUITests/SelectionAndPhotoFlowTests test`

Expected: PASS for selection, both photo entry points under injected UI-test services, permission denial, cancellation, and stale-result suppression.

- [ ] **Step 6: Commit**

```bash
git add ios/AligneBallet
git commit -m "feat: add native photo selection flow"
```

### Task 9: Check/Result UI, Bilingual Copy, Save, and Accessibility

**Files:**
- Create: `ios/AligneBallet/AligneBallet/Features/Check/CheckView.swift`
- Create: `ios/AligneBallet/AligneBallet/Features/Result/ResultView.swift`
- Create: `ios/AligneBallet/AligneBallet/Features/Result/PhotoSaveService.swift`
- Create: `ios/AligneBallet/AligneBallet/Resources/Localizable.xcstrings`
- Create: `ios/AligneBallet/AligneBalletTests/LocalizationTests.swift`
- Create: `ios/AligneBallet/AligneBalletTests/PhotoSaveServiceTests.swift`
- Create: `ios/AligneBallet/AligneBalletUITests/ResultFlowTests.swift`
- Modify: `ios/AligneBallet/AligneBallet/Info.plist`

**Interfaces:**
- Consumes: session store outcomes, feedback keys, annotated `UIImage`, and `PHPhotoLibrary`.
- Produces: `PhotoSaveServing.save(_ image: UIImage) async throws -> Void`; localized Check and Result presentation; Settings recovery for denied add-only permission.

- [ ] **Step 1: Write failing localization completeness tests**

Enumerate every UI, quality, technical-error, and feedback key. Assert both `en` and `zh-Hans` values are non-empty, differ where translation is required, and no rule identifier is shown directly to users.

- [ ] **Step 2: Write failing save-service tests**

Cover add-only authorized, not-determined then authorized, denied, restricted, and save failure. Denied save must leave the result visible and expose Settings; no automatic save is allowed.

- [ ] **Step 3: Implement Check and Result views**

Show activity without a fake percentage, actionable retake reasons, annotated image, up to three prioritized corrections, expandable full-body review, save, and reset.

- [ ] **Step 4: Add String Catalog and privacy copy**

Translate the current English meaning conservatively. Keep ballet terminology recognizable in both languages and preserve the qualified-teacher disclaimer.

- [ ] **Step 5: Run localization, save, UI, and accessibility tests**

Run: `xcodebuild -project ios/AligneBallet/AligneBallet.xcodeproj -scheme AligneBallet -destination 'platform=iOS Simulator,name=Aligne Tests' -only-testing:AligneBalletTests/LocalizationTests -only-testing:AligneBalletTests/PhotoSaveServiceTests test`

Run: `xcodebuild -project ios/AligneBallet/AligneBallet.xcodeproj -scheme AligneBallet -destination 'platform=iOS Simulator,name=Aligne Tests' -testLanguage en -only-testing:AligneBalletUITests/ResultFlowTests test`

Run: `xcodebuild -project ios/AligneBallet/AligneBallet.xcodeproj -scheme AligneBallet -destination 'platform=iOS Simulator,name=Aligne Tests' -testLanguage zh-Hans -only-testing:AligneBalletUITests/ResultFlowTests test`

Expected: all commands PASS. The UI tests assert accessibility labels, accessibility-size layout, contrast tokens, and 44-point targets.

- [ ] **Step 6: Commit**

```bash
git add ios/AligneBallet
git commit -m "feat: present and save bilingual analysis results"
```

### Task 10: Cross-Platform Acceptance, Performance, and Documentation

**Files:**
- Create: `ios/AligneBallet/AligneBalletTests/CrossPlatformAcceptanceTests.swift`
- Create: `ios/AligneBallet/AligneBalletTests/AnalysisPerformanceTests.swift`
- Create: `ios/AligneBallet/README.md`
- Modify: `README.md`
- Modify: `tools/evaluation/README.md`

**Interfaces:**
- Consumes: the complete app, shared deterministic fixture, and owner-supplied or licensed real-photo evaluation set outside Git.
- Produces: automated parity evidence, iPhone 13 timing/memory evidence, and reproducible setup/run instructions.

- [ ] **Step 1: Add deterministic cross-platform acceptance tests**

Assert measurement absolute error `<= 0.000001` and exact assessability, rule ID, semantic direction, Top 3 order, and annotation commands for the shared fixture.

- [ ] **Step 2: Add full-image semantic comparison tooling**

For each external reference image, record Web and iOS outputs without copying the image into Git. Require identical assessability; for assessable cases require at least two matching `region + direction` pairs in Top 3, or all output pairs when a conservative side returns fewer than two.

- [ ] **Step 3: Add performance and repeated-run tests**

On iPhone 13 measure normalization, whole detection, refined detection, rule evaluation, render, total time, and peak memory. Target about 5 seconds; any repeatable total above 8 seconds blocks completion. Run at least 20 sequential analyses and verify memory returns near baseline rather than increasing monotonically.

- [ ] **Step 4: Run the complete automated verification matrix**

Run:

```bash
pnpm test
pnpm test:agreement
pnpm test:e2e
pnpm build
pnpm sync:ios-model
xcodebuild -project ios/AligneBallet/AligneBallet.xcodeproj -scheme AligneBallet -destination 'platform=iOS Simulator,name=Aligne Tests' test
xcodebuild -project ios/AligneBallet/AligneBallet.xcodeproj -scheme AligneBallet -destination 'generic/platform=iOS' CODE_SIGNING_ALLOWED=NO IPHONEOS_DEPLOYMENT_TARGET=16.0 build
git diff --check
```

Expected: every command exits `0`. If compatible iOS 16 and iOS 17 simulator runtimes are available in Xcode Components, create `Aligne iOS 16` and `Aligne iOS 17` simulators and run:

```bash
xcodebuild -project ios/AligneBallet/AligneBallet.xcodeproj -scheme AligneBallet -destination 'platform=iOS Simulator,name=Aligne iOS 16' -only-testing:AligneBalletUITests test
xcodebuild -project ios/AligneBallet/AligneBallet.xcodeproj -scheme AligneBallet -destination 'platform=iOS Simulator,name=Aligne iOS 17' -only-testing:AligneBalletUITests test
```

Both must exit `0`. Otherwise document the unavailable runtime and require a physical/device-lab smoke test before claiming that OS version verified.

- [ ] **Step 5: Perform private real-photo and device verification**

On iPhone 13 or newer, test camera, PhotosPicker, each of five positions, both support sides, airplane-mode analysis, cancellation, denied permissions, save, 20-run memory, English, and Chinese. Keep participant photos and raw landmarks outside Git.

- [ ] **Step 6: Document setup and results**

Document Xcode/SPM setup, `pnpm sync:ios-model`, personal-team signing, simulator limitations, privacy behavior, verification commands, measured device/OS/time/memory, and any unverified OS version. Do not state App Store readiness.

- [ ] **Step 7: Final review and commit**

Run a branch review against this plan and the design spec, resolve findings, then:

```bash
git add README.md tools/evaluation/README.md ios/AligneBallet
git commit -m "test: verify native iPhone analysis flow"
```

## Completion Gate

Implementation is complete only when all ten tasks are committed, the web and iOS automated suites pass, the model runs offline on a physical iPhone, all five positions complete the native flow in English and Chinese, parity meets the explicit fixture and real-photo criteria, and the final report clearly distinguishes verified OS/device combinations from deployment-target compatibility.

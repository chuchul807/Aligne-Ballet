# Refined Pose Detection Design

**Date:** 2026-09-15
**Status:** Approved for implementation planning
**Scope:** Improve still-photo joint accuracy without uploading or retaining user photos.

## Problem

The current application runs the MediaPipe Pose Landmarker Lite model once on the complete image. A plausible but misplaced landmark can pass the visibility and limb-ratio checks, so it may still be drawn and used to produce feedback. This is most visible when the dancer occupies a small part of a landscape photo, or when a tutu, barre, or overlapping limb hides the hips and upper legs.

The change must improve landmark accuracy and suppress conclusions that cannot be supported by a single front or three-quarter still image. It must preserve the existing conservative feedback rules, full-body structural overlay, local-only image processing, and mobile web interface.

## Goals

µµ- Replace the Lite pose model with MediaPipe Pose Landmarker Heavy.
- Run a whole-image detection followed by a padded, dancer-focused detection.
- Map the refined landmarks back into the original image coordinate system.
- Compare both passes and mark unstable landmarks as unassessable.
- Prevent unstable landmarks from producing measurements, corrections, or annotation segments.
- Reject photos where the dancer is too small for a reliable refinement pass.
- Continue processing photos entirely in the browser and release temporary image memory after analysis.

## Non-goals

- Do not add server-side image analysis or photo storage.
- Do not add video analysis in this change.
- Do not add a second pose provider or a multi-model voting ensemble.
- Do not infer depth-only corrections from a single frontal image.
- Do not commit the user's example photos or screenshots as test fixtures.
- Do not change the supported ballet positions or rewrite their technique thresholds.

## Selected Approach

Use MediaPipe Pose Landmarker Heavy for both passes. The first pass locates one dancer in the full normalized image. A focused crop is derived from its reliable landmarks and passed through the same Heavy model a second time. The refined result is the primary skeleton. The whole-image result is retained only for subject-size validation and per-landmark agreement checks.

This is preferred over a model-only replacement because the Heavy model can still be confidently wrong under occlusion. It is preferred over running several model variants and voting because the latter adds substantially more download, memory, and inference cost on mobile devices without providing an independent source of evidence.

## Model and Asset Handling

- Bundle `pose_landmarker_heavy.task` from Google's published float16 Pose Landmarker Heavy model URL.
- Update the local asset synchronization script and detector configuration to use only the Heavy bundle. The Lite bundle is no longer a runtime fallback.
- Keep the model loaded for the lifetime of the application and reuse the same `PoseLandmarker` instance for both image passes.
- Retain `IMAGE` running mode and `numPoses: 2` so the quality stage can continue rejecting photos containing more than one person. Exactly one person is required for analysis.
- Continue returning the same 33 named pose landmarks. Map optional MediaPipe `presence` into the domain landmark when the runtime provides it; visibility remains mandatory.
- The approximately 31 MB initial model download and slower first analysis are accepted product trade-offs. Browser caching is expected to avoid downloading the model on every visit.

## Two-pass Detection Flow

### 1. Whole-image pass

Decode and normalize the image exactly once. Measure the current lighting, contrast, and blur metrics on that normalized source, then run the first Heavy-model detection against the complete image.

Run only the quality checks that do not depend on refined joint precision before creating the crop: no person, more than one person, an out-of-frame body, a clearly wrong camera view, lighting, contrast, and blur remain immediate retake results. Defer `required-joints-not-visible` until after the focused pass so a small but usable dancer is not rejected before refinement can improve the evidence.

### 2. Subject-size gate

Calculate a whole-image torso length from the shoulder and hip midpoints and a body extent from in-frame landmarks with visibility of at least `0.60`. The photo is too distant for reliable analysis if either condition is true:

- torso length is below `48` source pixels; or
- the larger dimension of the visible-landmark bounding box is below `180` source pixels.

Return a new `subject-too-small` retake reason. Its user-facing copy tells the dancer to move closer while keeping the full body, hands, and feet in frame.

### 3. Padded crop

Build the dancer bounding box from finite, in-frame landmarks with visibility of at least `0.60`. Include all reliable face, hand, body, heel, and foot-index landmarks. Expand the box by `20%` of its width on the left and right and `20%` of its height on the top and bottom, then clamp it to the source image.

The crop must contain the reliable shoulder and hip landmarks and at least one reliable ankle. If it cannot meet that minimum evidence, return the existing insufficient-pose-evidence result.

Render the crop into a temporary canvas at its native crop resolution, limited so its longest side does not exceed the existing `4096`-pixel analysis cap. Do not enlarge a low-resolution crop: cropping changes the dancer's share of the model input, while artificial upscaling adds no visual evidence.

### 4. Focused pass and coordinate mapping

Run the same Heavy detector against the crop. Require exactly one refined person. Convert every refined point back to full-image normalized coordinates:

```text
fullX = (cropLeft + cropX * cropWidth) / sourceWidth
fullY = (cropTop  + cropY * cropHeight) / sourceHeight
```

Preserve the refined `z`, `visibility`, and optional `presence`. The mapped refined landmarks become the landmarks stored in the result and displayed on the original image.

Run the required-joint visibility check against the mapped refined result. Refined low visibility contributes to unassessable regions and viability; it is not replaced by a confident whole-image estimate.

The temporary crop canvas is always disposed after the second detector call, including detector errors and retake outcomes.

## Cross-pass Agreement

Agreement is evaluated after mapping the focused result into full-image coordinates. Distances are divided by the refined torso length so the thresholds do not depend on image dimensions.

- Major structure landmarks—shoulders, elbows, hips, knees, and ankles—agree when their cross-pass distance is at most `0.12` torso lengths.
- Face, wrists, fingers, heels, and foot-index landmarks agree when their cross-pass distance is at most `0.18` torso lengths.
- A landmark is unstable if either pass is missing, non-finite, outside the frame, below `0.60` visibility, below `0.60` presence when presence is available, or exceeds its agreement threshold.
- Add `cross-pass-disagreement` and `low-presence` as reliability reasons. Unstable points have low confidence and are unassessable.
- Existing chain plausibility and overlap/occlusion checks still run on the refined landmarks. Agreement supplements those checks; it does not replace them.

Reliability propagation remains evidence-based. A measurement is assessable only when every landmark it names as evidence is assessable. Therefore:

- an unstable knee suppresses knee-extension feedback for that leg;
- an unstable hip suppresses pelvis-slope and hip-dependent working-leg height feedback;
- an unstable ankle or foot point suppresses foot placement and line feedback;
- unstable arm landmarks suppress only the affected arm evidence rather than the entire analysis.

The annotation builder draws structural joints and segments only when all landmarks required by that drawing command are assessable. It must never draw a segment through a cross-pass-disagreement point.

## Regional Coverage and User Experience

Map unstable evidence to the existing body regions: supporting leg, working leg, pelvis, torso, shoulders/arms, head, and feet. If the remaining measurements satisfy the existing position viability quorum, return a partial result. The full-body review marks affected regions as unassessable and explains that pose recognition was inconsistent or the body part was obscured.

If the remaining evidence does not satisfy both the existing core quorum and the selected position's specific quorum, return a retake result with `unstable-pose-landmarks`. Its copy asks for a closer photo with less clothing, barre, or limb overlap around the affected joints.

Do not show numeric confidence values, internal thresholds, model names, or detector-pass terminology in the interface. Keep the current concise English product copy style.

During analysis, the existing loading state remains visible for both detector passes. No new user step is added.

## Component Boundaries

- `MediaPipePoseDetector` owns MediaPipe initialization, Heavy-model configuration, provider-result mapping, and lifetime cleanup.
- A focused-crop module owns subject-size measurement, padded crop geometry, canvas creation, and crop-coordinate mapping. Its geometry functions are pure and independently tested.
- A refined-detection coordinator owns the two detector calls and temporary-canvas disposal. It returns the mapped refined landmarks plus cross-pass agreement evidence without evaluating ballet technique.
- Landmark reliability owns visibility, optional presence, frame, geometry, occlusion, and cross-pass disagreement decisions.
- The analysis pipeline owns quality outcomes, viability, rules, feedback composition, and annotations. It consumes refined detection instead of invoking a single detector pass directly.

The existing `PoseDetector.detect(source, width, height)` boundary remains unchanged so future video key frames can continue to use the provider adapter. Two-pass still-photo behavior is orchestration above that boundary, not a provider-specific feature.

## Failure Handling

- If the first pass fails, use the existing generic analysis error or quality retake behavior.
- If the subject-size gate fails, dispose the decoded image and return `subject-too-small`.
- If crop creation fails because of browser memory, dispose both sources and use the existing image-memory/normalization retake language.
- If the second pass finds no person or multiple people, treat the refined evidence as unstable and return `unstable-pose-landmarks`; never fall back silently to the first-pass skeleton.
- If only some regions disagree, return a partial result when the existing viability quorum permits it.
- Every error path disposes the temporary crop. Every non-success path also disposes the decoded full image according to the existing ownership contract.

## Testing Strategy

Follow test-driven development for every production behavior.

### Unit tests

- Subject size passes and fails exactly at the torso and body-extent boundaries.
- Crop geometry includes raised arms, extended working legs, and pointe feet, applies the `20%` padding, and clamps safely at image edges.
- Coordinate mapping returns the original full-image positions for landscape and portrait crops.
- Cross-pass agreement uses the correct `0.12` and `0.18` threshold groups.
- Missing, low-visibility, low-presence, and disagreeing points receive the expected reliability reasons.
- Temporary canvas disposal occurs after success, provider failure, and refined-person-count failure.
- The MediaPipe adapter maps optional presence and points to the Heavy model asset.

### Pipeline tests

- A distant landscape dancer triggers a focused second pass and stores mapped refined landmarks.
- A dancer below the minimum subject size receives the new retake reason and never reaches rules or annotation generation.
- A tutu/barre scenario with disagreeing hip or knee evidence suppresses pelvis and leg corrections.
- A single unstable region yields partial feedback when the remaining position evidence is viable.
- Too much disagreement produces a retake instead of first-pass fallback.
- Stable results preserve the current correction selection and full-body structural overlay behavior.

Tests use synthetic landmarks and generated canvases. The user's photos and screenshots are not copied into the repository. The original photos may be used manually and locally before release if the user supplies them; they remain outside source control and are neither uploaded nor persisted by the application.

### Full verification

- Run all unit and integration tests.
- Run TypeScript checking and the production build, including asset synchronization.
- Run the existing end-to-end suite at the supported mobile viewport.
- Manually verify one landscape full-body photo and one portrait photo with clothing or barre occlusion from privacy-safe local samples before publishing. If the user later supplies the two original photos, use them only for an additional local validation outside source control.
- Confirm the deployed site downloads the Heavy asset successfully, completes both passes, shows partial/retake copy correctly, and does not make an image-upload network request.

## Acceptance Criteria

- The deployed application uses the Heavy pose model for still photos.
- Every accepted still photo is processed with a whole-image pass and a focused pass.
- A distant but usable dancer is cropped with padding and re-evaluated without losing hands or feet.
- A dancer below the specified pixel evidence thresholds receives a retake instruction.
- Refined coordinates are drawn in the correct locations on the original image.
- Cross-pass-disagreeing joints are absent from measurements, corrections, and annotation segments.
- A hidden or unstable knee cannot generate a supporting-leg or working-leg straightness correction.
- A hidden or unstable hip cannot generate a pelvis or hip-height correction.
- Partial results remain possible when enough independent evidence survives.
- Temporary crop memory is released and photos remain browser-local and unpersisted.
- Existing supported poses, conservative rule thresholds, mobile single-card flow, and download behavior continue to pass their regression tests.

# Conservative Pose Analysis and Annotation — Design

**Status:** Approved in conversation; awaiting written-spec review

**Date:** 2026-09-10

**Product:** ALIGNÉ

## 1. Purpose and precedence

This design improves the existing single-photo ballet feedback flow after testing exposed three related problems:

- the annotated result shows too few landmarks, especially around the upper body and head;
- large-dimension photos are rejected or become impractical to analyse instead of being resized safely;
- posture rules can be stricter than the evidence supports, especially when an imprecise knee landmark makes a visually straight supporting leg appear bent.

This document extends the approved product design in `2026-09-03-ballet-position-feedback-design.md`. Where the two documents conflict, this document takes precedence for image normalisation, landmark reliability, single-view claims, conservative feedback, and annotation rendering.

## 2. Scope

This increment applies to the existing still-photo flow after the user has manually selected:

- the ballet position; and
- the dancer's own supporting side.

It changes image preprocessing, pose-evidence reliability, rule evaluation, feedback selection, and result annotations.

It does not add video analysis, automatic position recognition, multi-view reconstruction, a larger pose model, accounts, or teacher-labelled calibration. These remain future capabilities. The interfaces between detection, measurement, and rule evaluation must remain replaceable so a larger detector or position-inference stage can be added later without changing the feedback output contract.

## 3. Design principles

1. **No correction is better than an unsupported correction.** The system may analyse the rest of the body when one region is unreliable, but it must not guess about that region.
2. **A single photo supports only claims visible from its camera view.** Frontal-plane evidence cannot establish fore-aft alignment, true centre of mass, or three-dimensional rotation.
3. **Detection confidence is necessary but not sufficient.** A high model visibility value does not make a geometrically implausible landmark trustworthy.
4. **Feedback and annotations share the same evidence.** A numbered annotation must correspond to one displayed correction, and a displayed correction must be traceable to reliable landmarks and a rule.
5. **Thresholds are configuration, not hidden truth.** Initial conservative tolerances can later be calibrated against teacher review without rewriting the pipeline.

## 4. End-to-end analysis flow

### 4.1 Input validation and normalisation

The browser validates the image format, file safety limit, and decoded dimensions before pose detection.

- If the shortest decoded side is below 480 pixels, reject the image and retain the current retake guidance. The system does not upscale small images.
- If the longest decoded side is greater than 4096 pixels, resize it in the browser to a longest side of 4096 pixels while preserving aspect ratio and orientation.
- If the image is within those bounds, retain its decoded dimensions.
- Use the resulting normalised image for pose detection, measurement, preview, annotation rendering, and annotated-image download. This gives every downstream stage one coordinate space and prevents overlay drift.
- Retain the existing 12 MiB upload safety limit. This increment addresses excessive pixel dimensions after a file has passed that limit; it does not introduce streaming or server-side handling of arbitrarily large files.

When resizing occurs, the Check stage displays: “Large photo resized for analysis. Its proportions were preserved.” The result does not imply that resizing improved the underlying pose evidence.

If decoding or resizing fails because the browser cannot allocate sufficient memory, return a specific message asking the user to use a smaller export or retake the photo. Preserve the selected position and supporting side.

### 4.2 Pose extraction

The existing pose detector continues to produce landmark coordinates and detector visibility. The pipeline requests the main structural landmarks needed by this product:

- head location: nose and both ears;
- upper body: shoulders, elbows, and wrists;
- pelvis and legs: hips, knees, and ankles;
- feet: heels and foot-index/toe points.

Eyes and mouth points are not shown in the result because they add visual noise without improving the current ballet rules. The detector may still return them internally.

The user's supporting-side choice is always interpreted as the dancer's own left or right side, never the viewer's side. The pipeline keeps this semantic mapping separate from image coordinates.

### 4.3 Reliability gate

Before ballet rules run, a reliability evaluator assigns each required landmark and derived measurement an assessment state. The evaluator combines:

- detector visibility;
- whether the point is inside the image and sufficiently far from an accidental crop;
- connection consistency with adjacent landmarks;
- body-normalised limb-length plausibility;
- abrupt left/right swaps or self-crossing patterns inconsistent with the neighbouring chain;
- likely occlusion or ambiguity from overlapping limbs;
- whether the supplied camera view can support the requested measurement.

Every derived measurement returns a structured result containing:

- value, when computable;
- confidence category;
- assessable boolean;
- evidence landmark names;
- an internal reason when unassessable.

The rule engine cannot read a bare numeric measurement. It must consume this structured result and refuse to issue a correction when the measurement is unassessable or below the conservative confidence threshold.

### 4.4 Measurement and rule evaluation

Measurements remain body-normalised and independent of ballet wording. Rules then evaluate only reliable measurements for the selected position and expected view.

Rules that describe the same underlying evidence are merged or de-duplicated before prioritisation. In particular, general supporting-side stacking and Retiré-specific stacking must not produce two corrections from the same hip-to-ankle horizontal offset.

The system distinguishes:

- **clear deviation:** reliable evidence exceeds the correction threshold and may enter Top 3;
- **borderline:** reliable evidence falls inside the tolerance band and does not become a correction;
- **unassessable:** evidence is unreliable or the camera view cannot support the claim;
- **acceptable:** reliable evidence falls within the accepted range.

Only clear deviations can become numbered corrections.

### 4.5 Feedback composition

The Top 3 contains up to three clear, reliable, non-duplicate corrections. It is acceptable to return fewer than three when the photo does not provide three supported changes.

Borderline and unassessable findings do not enter Top 3. In the expandable body review, a relevant region may instead say: “Not enough evidence in this photo to recommend a change.” The interface does not expose percentages, raw angles, or model-confidence values.

Each correction contains one direct action and camera-view-aware wording. It must not expand beyond the structured observation supplied by the rule engine.

## 5. Conservative posture policy

### 5.1 Supporting-knee extension

Supporting-knee extension is calculated only when the supporting hip, knee, and ankle all pass the reliability gate.

Initial conservative thresholds are:

- less than 165 degrees: a clear bend that may generate a correction;
- 165 through less than 175 degrees: tolerance band; do not recommend straightening;
- 175 degrees or greater: visually straight for this product.

The less-than-165-degree threshold is necessary but not sufficient: the related landmarks and measurement must still be reliable. If the knee point is displaced, occluded, or geometrically inconsistent, the system marks the measurement unassessable rather than calling the leg bent.

These thresholds live in named rule configuration and must be covered by boundary tests. They are an initial product tolerance, not a medical or biomechanical definition of full extension.

### 5.2 Pelvis and support alignment

For a frontal Retiré / Passé photo, the system may evaluate visible left-right hip height and frontal-plane lateral displacement when both hip landmarks are reliable.

It may say, for example: “From this front view, your pelvis appears slightly higher on the working side.” It must not claim that the hip is forward or backward, that the dancer's true centre of mass is misplaced, or that the supporting hip must be directly over the ankle in three dimensions.

Any existing rule based only on horizontal image-space hip-to-ankle offset must be renamed and worded as a frontal-plane lateral alignment observation. It may not produce “Stack your supporting hip more directly over your ankle” without additional view evidence that the current MVP does not possess.

Pelvis tilt is evaluated only when both hips are reliable and the selected position's prescribed view supports a left-right comparison. Borderline tilt remains unreported.

### 5.3 Other regions

The same conservative policy applies to shoulders, arms, torso, working leg, feet, and head:

- all landmarks required by a rule must be reliable;
- the camera view must support the claim;
- the deviation must exceed its configured tolerance;
- overlapping rules must collapse into one observation;
- an annotation may not imply more precision than the text.

## 6. Annotation design

### 6.1 Neutral structural overlay

The annotated result shows the main structural landmarks that passed reliability checks, not only joints associated with corrections.

- Reliable structural landmarks use small, subdued rose dots.
- Reliable connections use thin, low-contrast rose lines.
- Head location is represented by the nose and both ear points. Head points do not need to be connected into a face outline.
- Connections appear for shoulders and arms, shoulder line, torso sides, hip line, both legs, and both feet where their endpoints are reliable.
- If either endpoint is unreliable, omit that connection. Do not draw a confident-looking dot or solid segment at an unreliable location.

This overlay helps the user see what the system detected while remaining visually secondary to the photo.

### 6.2 Correction overlay

Only Top 3 corrections receive dark numbered markers, direction arrows, or stronger guide lines.

- Numbers map one-to-one to the displayed feedback items.
- The numbered marker is placed at the relevant reliable region, not at a generic torso location.
- Multiple observations that are de-duplicated into one correction share one number.
- An arrow is shown only when the rule defines a defensible visible direction of change.
- Neutral joints remain visible underneath but cannot compete with correction markers.

The renderer consumes structured drawing commands in the same normalised coordinate space used for detection. It does not independently infer issue locations.

## 7. Mobile experience and error handling

The existing one-card-at-a-time mobile flow remains unchanged: Select, Frame, Check, Result.

- The automatic-resize notice appears in Check and does not create a new step.
- A photo below the 480-pixel minimum remains in Check with retake guidance.
- A normalisation failure remains in Check with a specific smaller-image/export message.
- A local unreliable body region does not reject an otherwise assessable photo; analysis continues for reliable regions.
- If too few required regions are reliable to assess the selected position, the existing quality gate requests a retake rather than producing posture feedback.
- Changing the selected position or supporting side invalidates the current result.

The output remains in English, including uncertainty messages, to match the current product language.

## 8. Component boundaries

Implementation should preserve focused responsibilities:

1. **Image normaliser:** decodes, applies dimension rules, resizes when necessary, and returns the one analysis image plus normalisation metadata.
2. **Pose detector adapter:** returns detector landmarks without ballet interpretation and remains replaceable by a larger model later.
3. **Landmark reliability evaluator:** checks visibility and spatial plausibility and returns per-landmark assessment states.
4. **Measurement layer:** derives view-specific geometry and returns value-plus-assessability objects.
5. **Rule engine:** applies configurable conservative thresholds and produces structured observations.
6. **Observation de-duplicator and prioritiser:** merges shared evidence and selects up to three clear corrections.
7. **Annotation command builder:** converts reliable structure and selected observations into neutral and numbered drawing commands.
8. **Renderer:** draws commands on the normalised image without posture logic.
9. **Mobile result UI:** presents resize state, annotated image, Top 3, and region-level uncertainty.

This separation allows the detector, ballet thresholds, and drawing style to change independently.

## 9. Acceptance criteria

The sample Retiré / Passé photo discussed during design becomes a regression fixture with the dancer's selected supporting side. Its expected behaviour is:

- the supporting leg is not described as bent;
- a visible frontal-plane pelvis tilt may be reported only if both hip landmarks and the tilt measurement pass the reliability gate;
- no correction claims fore-aft hip position, true balance, or three-dimensional hip-over-ankle stacking;
- reliable head and upper-body structural points are visible in the result;
- numbered markers correspond exactly to displayed corrections.

Additional automated coverage includes:

- knee-angle boundary cases immediately below 165, within 165–175, and at or above 175 degrees;
- high detector visibility paired with an implausibly displaced knee point;
- occluded or overlapping hip, knee, ankle, wrist, and foot landmarks;
- dancer-left and dancer-right supporting-side mappings;
- duplicate common and position-specific rules using the same evidence;
- a shortest side below 480 pixels;
- an ordinary valid image requiring no resize;
- a longest side above 4096 pixels that is resized with preserved aspect ratio;
- matching detection and annotation coordinates after resize;
- head, arm, torso, pelvis, leg, heel, and toe structure commands;
- omission of unreliable points and their attached segments;
- fewer than three supported corrections;
- exact number-to-feedback mapping in the rendered result;
- actionable messages for decode, memory, and quality-gate failures;
- the four-card flow at common phone widths.

Manual visual verification uses representative portrait photos to confirm that the neutral skeleton is legible but unobtrusive, corrections remain prominent, and overlays align at both phone preview size and downloaded-image resolution.

## 10. Future extension points

This increment intentionally leaves the following extension points without implementing them:

- a detector interface that can accept a larger or ballet-specific model;
- an optional position-candidate stage that can suggest a movement before the user confirms it;
- multiple PoseFrames for side views or video key frames;
- teacher-calibrated threshold sets and labelled evaluation photographs;
- view fusion for claims that cannot be supported by a single image.

Future stages must preserve the conservative rule that a user-confirmed action does not justify unsupported claims about an unreliable body region.

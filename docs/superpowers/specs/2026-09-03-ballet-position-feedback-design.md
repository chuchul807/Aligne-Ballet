# Ballet Position Feedback — Product and System Design

**Status:** Approved

**Date:** 2026-09-03

**Working product name used in mockups:** ALIGNÉ

## 1. Product summary

Ballet Position Feedback is a mobile-first web application for ballet students and dancers. A user uploads or takes a photo of a selected ballet position, and the application evaluates the visible pose against an expert-reviewable classical ballet standard.

The result contains:

- three prioritized corrections in English;
- an expandable full-body review;
- an annotated copy of the photo showing detected joints, highlighted problem areas, and directional adjustment arrows.

The product is a self-review aid for practice between classes. It does not replace a teacher, diagnose injuries, or prescribe medical treatment.

## 2. Product direction

### 2.1 MVP

The first release accepts one still photo taken from a prescribed camera angle. The user manually selects the position and supporting side before uploading the image.

The supported positions are:

1. Arabesque
2. Attitude derrière
3. Retiré / Passé

The interface and all generated feedback are in English. Standard French ballet terms remain untranslated.

### 2.2 Future releases

The architecture must allow one analysis session to contain more than one view or frame. Later releases may support:

- front and side photos of the same position;
- short practice videos and selected key frames;
- professionally photographed and licensed demonstrations;
- teacher-calibrated position rules;
- expanded confidence-aware inference for difficult beginner poses, while preserving explicit uncertainty language.

Automatic recognition of the ballet position is not required. Manual position selection can remain part of the final product.

## 3. Goals and non-goals

### 3.1 Goals

- Give a student a small number of clear, actionable corrections.
- Continue assessing a beginner whose pose differs substantially from the standard, when enough body landmarks remain visible.
- Make every visible correction traceable to an observed body region and an approved position rule.
- Communicate uncertainty instead of presenting weak inferences as facts.
- Produce a useful annotated image without requiring an exact overlay with another dancer's body.
- Provide an architecture that extends to multiple views and video without changing the feedback contract.

### 3.2 Non-goals for the MVP

- Automatic action or position classification.
- Real-time video coaching.
- Multi-view reconstruction or three-dimensional pose estimation.
- A user account, saved practice history, progress tracking, or social features.
- Skill-level-specific standards.
- Support for Vaganova, RAD, Cecchetti, or another named school as a separate mode.
- Medical, injury, pain, rehabilitation, or anatomical diagnosis.
- Exact comparison with a professional dancer's silhouette or body proportions.
- Training a ballet-specific computer-vision model from scratch.

## 4. Users and usage context

The primary users are ballet students and dancers who want feedback while practising outside class. All users are assessed against the same general classical ballet standard; the MVP does not ask them to identify as beginner, intermediate, or advanced.

The product should be framed as a practice assistant. Feedback must be specific enough to act on but should encourage the user to consult a teacher when the photo does not provide enough evidence or when a correction relates to pain or injury.

## 5. Standard library

The MVP standard library is rule-based rather than a single “perfect” demonstration photo. Each supported position has:

- a required camera view;
- a list of visible body regions required for analysis;
- acceptable geometric ranges and relative alignments;
- pose-specific observations and correction templates;
- priority and confidence rules;
- annotation instructions tied to each correction.

Initial camera views are:

- Arabesque: approximately 45-degree side view;
- Attitude derrière: approximately 45-degree side view;
- Retiré / Passé: frontal view.

The upload guide may mirror the expected orientation according to the supporting side chosen by the user.

The first standard library uses abstract skeleton examples, written ballet rules, and internal test photographs. Formal demonstration photography is not required for the MVP. When demonstration photos are added, they must be created or licensed for this use and reviewed by a qualified ballet teacher.

## 6. Evaluation rubric

### 6.1 Shared checks

Every supported position may evaluate the following visible dimensions:

- **Supporting leg:** knee extension and vertical support alignment.
- **Balance:** whether the visible body mass is organised over the supporting side.
- **Pelvis:** visible tilt, rotation, hiking, or loss of control.
- **Torso:** excessive lean, lumbar compensation, collapsed length, or visible rib flare.
- **Shoulders, arms, and head:** shoulder level, arm height, elbow and wrist line, and head direction.
- **Working leg and foot:** visible placement, knee shape, leg extension, foot articulation, and toe direction.

### 6.2 Position-specific checks

#### Arabesque

- Extension of the working leg.
- Relationship between leg height, pelvic control, and torso compensation.
- Supporting-leg organisation.
- Shoulder and arm line appropriate to the selected presentation.

#### Attitude derrière

- Direction of the working thigh.
- Visible relationship between thigh, bent knee, and foot.
- Pelvic stability and torso compensation.
- Supporting-leg organisation.

#### Retiré / Passé

- Placement of the working foot relative to the supporting leg.
- Visible opening and placement of the working knee.
- Vertical pelvis and torso organisation.
- Supporting-leg alignment and balance.

### 6.3 Limits of a single two-dimensional image

The system may comment only on what the prescribed view can reasonably show. It must not claim certainty about internal hip rotation, force, pain, muscular engagement, or depth relationships hidden by the camera angle. A rule that cannot be assessed from the supplied view returns an unassessable state rather than a negative score.

## 7. Recommended technical approach

The MVP uses a hybrid analysis pipeline.

1. A pose-estimation component detects body landmarks and assigns confidence to each landmark.
2. A geometry component calculates relative angles, slopes, distances, and alignments using body-normalised measurements.
3. A position-specific rule engine evaluates those measurements against expert-reviewable ranges and produces structured observations.
4. A constrained language component converts structured observations into concise English corrections drawn from approved instruction patterns.
5. An annotation renderer places the skeleton, issue highlights, and directional arrows on the uploaded image.

This approach is preferred over direct end-to-end visual-language evaluation because it is more explainable, repeatable, and testable. It is preferred over a custom ballet model because the project does not yet have a sufficiently large teacher-labelled dataset.

The language component may use the original image for visible context, but it cannot introduce a correction without a corresponding structured observation from the rule engine.

## 8. System components

### 8.1 Mobile web client

- Captures position and supporting-side selection.
- Shows the pose-specific framing guide.
- Accepts camera capture or photo upload.
- Displays quality-check outcomes, results, and download controls.

### 8.2 Upload and quality gate

- Validates file type and supported image size.
- Rejects images containing no person or more than one person.
- Checks that required body regions are inside the frame.
- Checks whether required landmarks meet minimum confidence.
- Checks whether the camera view is sufficiently close to the prescribed view.
- Checks whether lighting and image clarity are sufficient for reliable landmark detection.
- Returns specific retake guidance instead of posture feedback when the image cannot be assessed.

### 8.3 Pose extraction

- Produces two-dimensional landmarks and per-landmark confidence.
- Normalises left and right semantics using the user-selected supporting side.
- Keeps raw measurements separate from ballet interpretation.

### 8.4 Rule engine

- Loads rules for the selected position and expected view.
- Produces structured observations with evidence, priority, confidence, and annotation metadata.
- Evaluates large deviations as long as the relevant landmarks remain visible; it does not require the pose to resemble a reference template closely.

### 8.5 Feedback composer

- Selects the three highest-priority actionable observations.
- Produces a full-body review grouped by body region.
- Uses natural language rather than displaying joint angles or numeric scores.
- Applies confidence-aware wording and safety constraints.

### 8.6 Annotation renderer

- Draws major detected joints and connections.
- Highlights body regions associated with the Top 3 corrections.
- Draws simple arrows indicating the suggested direction of adjustment.
- Does not overlay another dancer's silhouette.

### 8.7 Temporary result service

- Returns the feedback and annotated image to the current anonymous session.
- Supports downloading the result.
- Deletes data according to the retention rules in Section 13.

## 9. Data model and extension boundary

An analysis is modelled as a session containing one or more observations of the same selected position:

- **AnalysisSession:** selected position, supporting side, expected views, status, and expiration time.
- **PoseFrame:** one uploaded photo or, in the future, one video key frame; includes view type and capture metadata.
- **LandmarkSet:** detected joints, connections, and confidence values for a frame.
- **MeasurementSet:** body-normalised geometric measurements derived from landmarks.
- **Observation:** affected region, issue type, evidence, correction direction, priority, confidence, and assessability.
- **FeedbackItem:** user-facing English text linked to one or more observations.
- **AnnotatedResult:** rendered image and drawing instructions linked to feedback items.

The MVP creates one PoseFrame per AnalysisSession. Multi-view photos and videos add frames to the same structure rather than creating a separate feedback system.

## 10. Confidence and inference policy

The system should still attempt to identify deviations when a beginner is far from the standard. Confidence depends on landmark visibility and evidence quality, not on how closely the pose matches the standard.

- **High confidence:** state the correction directly, such as “Straighten your supporting knee.”
- **Medium confidence:** use qualified wording, such as “Your pelvis may be lifting on the working side.”
- **Low confidence or unassessable:** do not turn the observation into a correction; explain that the region cannot be confirmed from the current image when relevant.

The final result does not expose percentages, joint angles, or numeric confidence values. Confidence changes the wording and whether a correction is included.

## 11. Feedback prioritisation and output contract

Each structured correction contains:

- body region;
- observed issue;
- user action;
- priority category;
- confidence category;
- evidence landmarks or measurements;
- annotation type and coordinates.

The Top 3 are selected in this order:

1. visible issues that may affect stability or create poor load distribution;
2. issues that substantially change the structure of the selected position;
3. line and presentation issues involving the arms, head, shoulders, wrists, or feet.

The result page contains:

- the annotated image;
- three numbered corrections, each phrased as one direct action;
- an expandable review covering supporting leg, working leg, pelvis, torso, shoulders and arms, head, and feet;
- qualified language where confidence is medium;
- a reminder that the tool supplements rather than replaces a ballet teacher;
- a download action for the annotated image and written feedback.

## 12. Mobile experience

The visual direction is a restrained ballet-inspired rose and soft-pink palette. The interface must preserve sufficient contrast and must not rely on colour alone to communicate errors or success.

The phone interface displays one card at a time. Four compact tabs allow direct movement among available stages:

1. **Select:** choose position and supporting side.
2. **Frame:** view camera angle, full-body outline, camera-height guidance, and clothing/visibility guidance; then take or upload a photo.
3. **Check:** view whether the body, angle, and required joints are suitable; retake or start analysis.
4. **Result:** view the annotated photo, Top 3 corrections, expandable full-body review, and download action.

Before analysis, a user may return to completed stages without losing the selected position. The Result tab becomes available only after a successful analysis.

## 13. Error handling and privacy

### 13.1 Input and analysis errors

- An unsuitable photo remains at the Check stage and displays every actionable retake reason.
- If the entire photo is valid but one region cannot be assessed, the application analyses the remaining regions and reports the local uncertainty.
- If processing fails, the selected position and supporting side remain available and the user may retry the same upload.
- Generated feedback is never shown for the wrong manually selected position; changing the selected position invalidates the current analysis result.

### 13.2 Privacy and retention

- The MVP has no user accounts and stores no training history.
- The original uploaded photo is deleted after analysis and annotated-image generation complete.
- Failed or abandoned uploads are deleted when the anonymous session expires and no later than 24 hours after upload.
- Derived feedback and the annotated result are retained only for the active anonymous session and for no longer than 24 hours.
- User photos are not used for model training or product datasets by default.
- Any future collection of photos for improvement or training requires a separate, explicit opt-in consent flow.

## 14. Evaluation and testing

### 14.1 Ground-truth set

For each supported position, the initial evaluation set includes:

- acceptable examples;
- photos with one or more common deviations;
- large beginner deviations that remain visually assessable;
- invalid photos with crop, occlusion, lighting, view, or multi-person problems.

The product owner initially writes the expected Top 3 corrections for each assessable photo. A later evaluation round replaces or calibrates these labels through review by qualified ballet teachers.

### 14.2 Primary MVP acceptance criterion

On at least 80% of assessable evaluation photos, at least two of the system's Top 3 corrections must agree with the human review on both the affected body region and the required adjustment direction. Wording does not need to match.

### 14.3 Additional verification

- Confirm that invalid photos are rejected with the correct retake reason.
- Confirm that strongly non-standard beginner poses still receive analysis when the required landmarks are visible.
- Confirm that low-confidence observations are qualified or withheld.
- Confirm that every displayed correction links to visible evidence and an approved rule.
- Confirm that annotations identify the same region and direction described by the text.
- Confirm that the four-stage single-card interface works at common phone widths and remains keyboard and screen-reader operable.
- Confirm that raw uploads and expired results follow the retention policy.

## 15. Delivery sequence

Implementation should proceed in the following product increments:

1. Define the structured observation and feedback contracts.
2. Build the single-card mobile upload and quality-check flow using test fixtures.
3. Integrate general pose landmark extraction and annotation rendering.
4. Implement and validate rules for one position, beginning with Arabesque.
5. Add Attitude derrière and Retiré / Passé after the Arabesque evaluation loop is stable.
6. Add constrained English feedback generation and the full-body review.
7. Build the evaluation harness and measure agreement against the labelled photo set.
8. Add deletion and expiry controls, then conduct an end-to-end privacy and accessibility check.

This sequence reduces risk by proving the complete evaluation loop for one position before expanding the rule library.

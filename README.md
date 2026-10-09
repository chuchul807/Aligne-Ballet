# ALIGNÉ ballet feedback MVP

ALIGNÉ gives a dancer a constrained, single-photo practice check. It is an implemented MVP candidate, not a validated coaching tool until it passes the real-photo agreement gate below.

## Run locally

Prerequisites: a current Node.js LTS release and pnpm.

```sh
pnpm install
pnpm dev
```

Run unit and component checks with `pnpm test`, the agreement scorer checks with `pnpm test:agreement`, and phone-sized end-to-end checks with `pnpm test:e2e`. Playwright's Chromium and WebKit browsers can be installed with `pnpm exec playwright install chromium webkit`.

The browser model assets are MediaPipe Pose Landmarker Lite files obtained through `pnpm sync:assets`. Their source is the [MediaPipe Pose Landmarker documentation](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker). Do not commit downloaded model assets or participant photos.

## Supported use

The MVP supports one still image at a time:

- Arabesque and Attitude derrière: three-quarter side view.
- Retiré / Passé, À la seconde, and Tendu croisé devant: front view.
- Select the supporting side manually before uploading.

Use a full-body image, including feet, with one person and adequate lighting. The app can only discuss visible, screen-detectable features in the prescribed view. It cannot diagnose pain, injuries, force, internal rotation, muscular engagement, or hidden depth relationships. Work with a qualified teacher for coaching, health, or safety decisions.

## Privacy

There are no user accounts, saved training histories, or intentional upload persistence in this MVP. A selected image, decoded canvas, feedback, and annotated result stay in the active browser session and are released when replaced, reset, or the page closes. The release checks verify that a synthetic fixture causes no `localStorage` or IndexedDB writes and no POST request after the test services are ready. Images are not used for training or datasets by default; any future collection requires explicit opt-in consent.

## Product acceptance

See [the real-photo review protocol](evaluation/README.md). The owner must collect owned or explicitly licensed photos across all supported positions, label assessability and expected corrections before seeing the output, and score region-plus-direction agreement. At least 80% of assessable photos must have two or more Top 3 matches; unassessable cases are reported separately as quality-gate accuracy. Synthetic fixtures cannot satisfy this acceptance gate.

The current numerical image, visibility, and rule thresholds are initial engineering values. Product-owner review and qualified ballet-teacher calibration are required before treating them as coaching standards.

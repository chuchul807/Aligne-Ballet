# Aligne Ballet Repository Architecture

**Status:** Current architecture and repository organization

**Date:** 2026-10-11

**Production site:** <https://aligneballet.online/>

## 1. Purpose

Aligne Ballet is a browser-based ballet practice assistant. A dancer selects one of five supported positions, follows a position-specific photography guide, uploads a photo, and receives focused correction suggestions together with an annotated image. The application is intended to support independent practice when a teacher is not present.

The repository is organized to preserve that experience and analysis behavior while presenting the project as a self-contained technical work on its own production domain.

## 2. Repository Invariants

The repository must:

- preserve all existing application behavior;
- preserve the five supported positions: arabesque, attitude derriere, retire/passe, a la seconde, and tendu croise devant;
- preserve local image processing, pose detection, quality checks, feedback composition, annotation, and image download;
- preserve the existing implementation plans;
- keep production deployment compatible with the Alibaba Cloud server at `47.85.20.13`;
- remove obsolete hosted-site and serverless-worker integrations;
- make folder responsibilities understandable from the repository tree;
- reduce production and development dependencies where they are no longer needed;
- retain the current Git history without rewriting old commits.

Repository maintenance must not:

- redesign the user interface;
- modify ballet assessment thresholds or feedback wording;
- change pose-detection models or runtime assets;
- add a backend service;
- move or refactor the internal `src/` modules merely for cosmetic reasons;
- delete useful design evidence, screenshots, tests, evaluation tooling, or implementation history.

## 3. Target Runtime Architecture

The production application is a standard React and Vite static site.

1. `pnpm build` produces a static `dist/` directory.
2. The existing prebuild asset-sync step copies the pose model and required WebAssembly assets into the public build.
3. The Alibaba Cloud web server serves `dist/` for `https://aligneballet.online/`.
4. All photo decoding, pose estimation, analysis, feedback generation, and annotation continue to run in the browser.
5. No application backend, serverless worker, redirect site, or provider-specific build adapter is required.

The site metadata will use the production domain for canonical, Open Graph, and social-preview URLs. The social image will resolve from `https://aligneballet.online/og.png`.

## 4. Product Flow and Supported Views

The interface presents one mobile-first card at a time across four stages: Select, Frame, Check, and Result. The dancer manually chooses both the position and the dancer's own supporting side before selecting a photo.

| Position | Required camera view |
| --- | --- |
| Arabesque | Three-quarter side |
| Attitude derrière | Three-quarter side |
| Retiré / Passé | Front |
| À la seconde | Front |
| Tendu croisé devant | Front |

Each position has its own framing guidance, viability requirements, measurements, rule set, correction wording, and annotations. The prescribed view limits which visual claims are supportable: the application does not infer hidden depth relationships, internal rotation, true centre of mass, pain, force, or muscular engagement from one still image.

## 5. Privacy and Image Lifecycle

Photo processing remains local to the browser. The application has no account system, server upload, training-data collection, saved practice history, analytics, `localStorage`, or IndexedDB persistence.

An uploaded file is decoded into an in-memory analysis image. Object URLs, temporary canvases, decoded sources, pose results, and rendered output are released when the user replaces the image, resets the flow, or leaves the page. Regression tests use synthetic or derived fixtures rather than participant photographs. Any future photo collection requires separate, explicit opt-in consent.

## 6. Analysis Architecture

### 6.1 Image normalization

- Reject files above `12 MiB` before decoding.
- Reject an image whose shortest decoded side is below `480 px`; never upscale it.
- Resize an image whose longest decoded side exceeds `4096 px` to a `4096 px` longest side while preserving orientation and aspect ratio.
- Use the same normalized coordinate space for image metrics, detection, measurements, annotations, preview, and download.

### 6.2 Refined pose detection

MediaPipe Pose Landmarker Heavy runs in `IMAGE` mode with `numPoses: 2`, allowing multi-person photos to remain rejectable. Detection uses two passes behind the `PoseDetector` boundary:

1. Detect the dancer in the complete normalized image.
2. Reject a subject whose torso is below `48 px` or whose visible body extent is below `180 px`.
3. Pad the detected dancer box by `20%` on each side, clamp it to the image, and run a refined detection on that crop.
4. Map refined landmarks back into the normalized image coordinate system.
5. Compare both passes before allowing a landmark into later analysis.

The minimum visibility and optional presence score is `0.60`. Cross-pass disagreement may not exceed `0.12` refined-torso lengths for major joints or `0.18` for face, hands, and feet. A disagreeing landmark is not used for measurements, corrections, highlights, structural joints, or skeleton segments.

### 6.3 Evidence and feedback boundaries

```text
pose landmarks
    -> landmark reliability
    -> evidence-backed measurements
    -> position-specific deterministic rules
    -> conservative feedback composition
    -> annotation commands and canvas rendering
```

Reliability combines score, normalized coordinates, crop status, overlap, cross-pass agreement, and limb-chain plausibility. Measurements carry value, confidence, assessability, and evidence. The rule engine owns every correction; display copy does not invent new coaching claims.

Only high-confidence, clearly out-of-tolerance observations may enter the prioritized Top 3. Returning fewer than three corrections is valid. Medium-confidence observations use qualified language, while low-confidence or unassessable observations are suppressed. Numbered annotations map one-to-one to displayed corrections, and the structural overlay draws only reliable landmarks and connections.

### 6.4 Evaluation boundary

Unit and synthetic-fixture tests prove deterministic behavior but cannot establish coaching accuracy. Product acceptance uses owned or explicitly licensed photos that are labelled before system output is viewed. At least `80%` of assessable photos must have two or more matching region-plus-direction pairs in the Top 3; unassessable photos are reported separately through quality-gate accuracy. Qualified ballet-teacher calibration remains a future improvement.

## 7. Target Repository Structure

```text
.
├── docs/
│   ├── architecture.md
│   ├── images/
│   └── implementation-plans/
├── public/
├── scripts/
├── src/
├── tests/
│   ├── builders/
│   ├── config/
│   ├── e2e/
│   └── fixtures/
├── tools/
│   └── evaluation/
├── README.md
├── LICENSE
├── index.html
├── package.json
├── playwright.config.ts
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
├── tsconfig.json
├── vite.config.ts
└── vitest.config.ts
```

### Folder responsibilities

- `src/` contains the production application and its colocated unit tests. Its existing domain-oriented subfolders remain unchanged.
- `public/` contains runtime assets that must be copied into the static build, including pose models, WebAssembly files, and the social-preview image.
- `scripts/` contains build-time maintenance scripts, currently the pose-runtime asset synchronization step.
- `tests/` contains cross-module test builders, browser tests, fixtures, and test-only configuration.
- `tools/evaluation/` contains offline real-photo agreement tooling. It is useful for validating analysis quality but is not shipped as application code.
- `docs/images/` contains screenshots used by the README.
- `docs/implementation-plans/` preserves the project's implementation history in a clear, neutral location.
- `docs/architecture.md` explains the current system boundaries, deployment model, and repository organization.

Standard project configuration remains at the repository root where common tooling expects it. Root configuration should not be moved solely to reduce the number of visible files.

## 8. Repository Maintenance

### Hosting and deployment

The repository contains no obsolete hosted-site metadata, static-site adapter, serverless worker, worker configuration, or related package dependencies. The Vite configuration contains only the React application configuration needed for a conventional static build.

Generated build output, local package caches, browser-test output, operating-system metadata, and local deployment state remain ignored rather than committed.

### Documentation

The four implementation plans live in `docs/implementation-plans/` with their technical content preserved and their status expressed as neutral engineering records.

This document consolidates the useful architectural information from the earlier sequential design documents, so redundant copies and their old tool-specific directory structure are not required.

The README links to the current evaluation protocol, screenshots, architecture, and plans. Its deployment note states that Alibaba Cloud serves the production build and that `pnpm build` produces the deployable `dist/` directory.

### Tests and evaluation tooling

Offline evaluation files live in `tools/evaluation/`. Test-only Vite and Playwright configuration checks live in `tests/config/`. Package scripts, imports, README links, and configuration references use those paths.

### Dependencies

The runtime dependency set is limited to code shipped to the browser. Dependencies used exclusively by tests, build scripts, or evaluation tools belong in `devDependencies`.

The lockfile is regenerated through the package manager rather than edited manually. The native-build allowlist contains only packages still present after installation.

### Images

Screenshots and the social-preview image may receive lossless optimization only. Optimization is optional and must be skipped if identical rendered output cannot be confidently preserved.

## 9. Compatibility and Data Flow

The cleanup does not change the analysis pipeline:

```text
position selection
    -> position-specific framing guidance
    -> local photo upload and quality validation
    -> in-browser pose landmark detection
    -> measurement and reliability checks
    -> position-specific rule evaluation
    -> focused feedback composition
    -> annotated result rendering and download
```

Repository organization changes only file locations, build configuration, documentation, and unused dependencies. Imports and scripts are updated atomically with file moves so committed commands remain functional.

## 10. Error Handling and Deployment Safety

- A failed model or WebAssembly asset copy must fail the production build rather than produce a silently broken deployment.
- Browser-visible failures for image loading, pose detection, or insufficient photo quality remain unchanged.
- The production build must not depend on a network call to a removed hosting platform.
- Repository changes do not alter DNS, the Alibaba Cloud server, TLS certificates, or deployed files. Deployment is a separate explicit action after repository changes pass verification.
- Existing uncommitted feature work must remain untouched and must not be included accidentally in cleanup commits.

## 11. Verification

Repository changes are acceptable only after all of the following succeed:

1. Install dependencies from the committed lockfile.
2. Run the complete unit-test suite.
3. Run the real-photo agreement/evaluation suite from its new location.
4. Run the Playwright end-to-end suite.
5. Produce a clean production build with `pnpm build`.
6. Serve `dist/` locally and complete the mobile flow: select a position, upload a photo, pass or partially pass photo checks, analyze the pose, view feedback, and download the annotation.
7. Confirm the production bundle contains the pose model and required WebAssembly assets at the expected URLs.
8. Confirm canonical and social metadata use `https://aligneballet.online/`.
9. Confirm the current tracked tree contains no obsolete provider branding, configuration, or dependencies.
10. Confirm `git diff --check` reports no whitespace errors.

If a pre-existing test fails before the cleanup, record that baseline and require the reorganized repository to behave no worse. Any new failure caused by the cleanup blocks completion.

## 12. Git History Policy

The repository was reorganized without rewriting old commits, because history rewriting is destructive, invalidates existing commit references, and is unnecessary for presenting the current project. A complete historical purge would be a separate operation requiring explicit approval.

## 13. Acceptance Criteria

The repository remains release-ready when:

- the repository matches the target structure;
- existing implementation plans remain available;
- obsolete hosting files and dependencies are absent from the current tree;
- the README and metadata reference the production domain;
- application behavior and visual output remain unchanged;
- tests, offline evaluation, end-to-end checks, and production build pass;
- the repository is understandable without relying on platform-specific or agent-specific context.

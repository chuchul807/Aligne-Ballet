# Aligne Ballet Repository Architecture

**Status:** Proposed repository-cleanup design

**Date:** 2026-10-11

**Production site:** <https://aligneballet.online/>

## 1. Purpose

Aligne Ballet is a browser-based ballet practice assistant. A dancer selects one of five supported positions, follows a position-specific photography guide, uploads a photo, and receives focused correction suggestions together with an annotated image. The application is intended to support independent practice when a teacher is not present.

This design reorganizes and lightens the repository without changing that user experience or the analysis behavior. It also makes the current repository suitable for an admissions portfolio: the project should read as a self-contained technical work, use its own production domain, and avoid obsolete hosting-provider artifacts.

## 2. Goals and Constraints

The cleanup must:

- preserve all existing application behavior;
- preserve the five supported positions: arabesque, attitude derriere, retire/passe, a la seconde, and tendu croise devant;
- preserve local image processing, pose detection, quality checks, feedback composition, annotation, and image download;
- preserve the existing implementation plans;
- keep production deployment compatible with the Alibaba Cloud server at `47.85.20.13`;
- remove obsolete hosted-site and serverless-worker integrations;
- make folder responsibilities understandable from the repository tree;
- reduce production and development dependencies where they are no longer needed;
- retain the current Git history without rewriting old commits.

The cleanup must not:

- redesign the user interface;
- modify ballet assessment thresholds or feedback wording;
- change pose-detection models or runtime assets;
- add a backend service;
- move or refactor the internal `src/` modules merely for cosmetic reasons;
- delete useful design evidence, screenshots, tests, evaluation tooling, or implementation history.

## 3. Target Runtime Architecture

The production application will be a standard React and Vite static site.

1. `pnpm build` produces a static `dist/` directory.
2. The existing prebuild asset-sync step copies the pose model and required WebAssembly assets into the public build.
3. The Alibaba Cloud web server serves `dist/` for `https://aligneballet.online/`.
4. All photo decoding, pose estimation, analysis, feedback generation, and annotation continue to run in the browser.
5. No application backend, serverless worker, redirect site, or provider-specific build adapter is required.

The site metadata will use the production domain for canonical, Open Graph, and social-preview URLs. The social image will resolve from `https://aligneballet.online/og.png`.

## 4. Target Repository Structure

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

## 5. Repository Cleanup

### Hosting and deployment

Remove the obsolete hosted-site metadata, static-site adapter, serverless worker, worker configuration, related cached state, and their package dependencies. The Vite configuration will retain only the React application configuration needed for a conventional static build.

Generated build output, local package caches, browser-test output, operating-system metadata, and local deployment state remain ignored rather than committed.

### Documentation

Move the three existing implementation plans into `docs/implementation-plans/` without removing their technical content. Provider- or agent-specific instructions that are not part of the project itself may be rewritten as neutral engineering instructions.

Consolidate the useful architectural information from the existing sequential design documents into this document. Once the consolidated document is verified, remove the redundant design-document copies and their old tool-specific directory structure.

Update README paths after moving evaluation tooling, screenshots, or plans. Add a concise deployment note stating that the production build is served from Alibaba Cloud and that `pnpm build` produces the deployable `dist/` directory.

### Tests and evaluation tooling

Move offline evaluation files from the top-level `evaluation/` directory to `tools/evaluation/`. Move test-only Vite and Playwright configuration variants to `tests/config/`. Update package scripts, imports, README links, and configuration references so that all existing commands continue to work.

### Dependencies

Remove packages used only by the obsolete hosting integrations. Keep the runtime dependency set limited to code shipped to the browser. Dependencies used exclusively by tests, build scripts, or evaluation tools belong in `devDependencies`.

Regenerate the lockfile through the package manager rather than editing resolved dependency entries manually. Reduce the native-build allowlist to packages still present after installation.

### Images

Screenshots and the social-preview image may receive lossless optimization only. Optimization is optional and must be skipped if identical rendered output cannot be confidently preserved.

## 6. Compatibility and Data Flow

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

Only file locations, build configuration, documentation organization, and unused dependencies change. Imports and scripts must be updated atomically with file moves so there is no intermediate committed state with broken commands.

## 7. Error Handling and Deployment Safety

- A failed model or WebAssembly asset copy must fail the production build rather than produce a silently broken deployment.
- Browser-visible failures for image loading, pose detection, or insufficient photo quality remain unchanged.
- The production build must not depend on a network call to a removed hosting platform.
- The cleanup will not alter DNS, the Alibaba Cloud server, TLS certificates, or the currently deployed files. Deployment is a separate explicit action after the repository changes pass verification.
- Existing uncommitted feature work must remain untouched and must not be included accidentally in cleanup commits.

## 8. Verification

The reorganized repository is acceptable only after all of the following succeed:

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

## 9. Git History Policy

The cleanup changes the current branch only. It does not rewrite old commits, because history rewriting is destructive, invalidates existing commit references, and is unnecessary for presenting the current repository. A complete historical purge would be a separate operation requiring explicit approval.

## 10. Acceptance Criteria

The work is complete when:

- the repository matches the target structure;
- existing implementation plans remain available;
- obsolete hosting files and dependencies are absent from the current tree;
- the README and metadata reference the production domain;
- application behavior and visual output remain unchanged;
- tests, offline evaluation, end-to-end checks, and production build pass;
- the repository is understandable without relying on platform-specific or agent-specific context.

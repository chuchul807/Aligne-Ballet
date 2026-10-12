# Repository Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert Aligne Ballet into a clearly organized, provider-neutral React/Vite static-site repository without changing analysis behavior, visual output, or the five-position user flow.

**Architecture:** Keep the existing browser-only application and domain-oriented `src/` modules intact. Remove obsolete hosting adapters, relocate offline evaluation and test-only files into explicit tool/test folders, consolidate architectural documentation, and verify the resulting `dist/` as a conventional static build for Alibaba Cloud.

**Tech Stack:** React 19, TypeScript 7, Vite 8, MediaPipe Tasks Vision, Vitest, Playwright, pnpm, Alibaba Cloud static hosting.

**Spec:** `docs/architecture.md`

## Global Constraints

- Preserve the current five-position feature work, including uncommitted files present when this plan was written; cleanup commits must not overwrite or silently omit that work.
- Preserve all existing application behavior, assessment thresholds, feedback wording, annotation rendering, and download behavior.
- Keep photo processing, pose detection, analysis, and annotation entirely in the browser.
- Keep the pose model and WebAssembly asset synchronization step working before every development and production build.
- Preserve all four implementation plans, including this plan, under `docs/implementation-plans/`.
- Use `https://aligneballet.online/` for canonical and social metadata.
- Keep deployment compatible with the Alibaba Cloud server at `47.85.20.13`; do not change DNS, TLS, or live server files as part of repository cleanup.
- Do not rewrite Git history.
- Do not lossily recompress screenshots or `public/og.png`.
- Begin execution only from a recoverable snapshot that includes the current dirty feature work. If the worktree is still dirty, stop and account for those changes before applying this plan.

## Review Focus

- Dirty five-position feature work: every cleanup commit must contain only its named files and must not discard or absorb unrelated source changes.
- Static build shape: `pnpm build` must produce `dist/index.html` and browser assets, not a worker/server bundle or provider-specific subdirectories.
- Runtime assets: the Heavy pose model and MediaPipe WebAssembly files must be present in `dist/` and load from the existing absolute browser paths.
- Relocated tooling: evaluation imports, package scripts, configuration tests, and README links must resolve from their new paths on a case-sensitive filesystem.
- Public presentation: current source, metadata, and documentation must use the production domain and contain no obsolete hosting brand or agent-tool instructions.

---

### Task 0: Protect Existing Feature Work and Record the Baseline

**Files:**

- Inspect only: the complete working tree and index.
- Do not modify or commit existing feature files without the user's explicit review of that separate work.

**Interfaces:**

- Consumes: the current dirty five-position implementation and its untracked tests, rules, screenshots, and refined-pose documents.
- Produces: a recoverable, identified starting revision and baseline verification results for comparison after cleanup.

- [ ] **Step 1: Inventory all existing changes**

Run: `git status --short && git diff --stat && git diff --cached --stat && git ls-files --others --exclude-standard`

Expected: every modified and untracked file is explained as feature work, documentation, generated output, or local tooling state. Stop if any file's ownership is unclear.

- [ ] **Step 2: Establish a recoverable starting revision**

The cleanup must begin from a clean branch that contains the intended five-position state. Review and commit that feature work separately, or use another user-approved recoverable snapshot. Do not hide it in a cleanup commit and do not discard it.

- [ ] **Step 3: Run the full pre-cleanup baseline**

Run: `pnpm test && pnpm test:agreement && pnpm build && pnpm test:e2e`

Expected: all commands pass. If anything fails, record the exact existing failure before cleanup and require the final state to behave no worse.

---

### Task 1: Relocate Test-Only Configuration Checks

**Files:**

- Move: `vite.config.test.ts` -> `tests/config/vitest.config.test.ts`
- Move: `playwright.config.test.ts` -> `tests/config/playwright.config.test.ts`
- Modify: `tests/config/vitest.config.test.ts`
- Modify: `tests/config/playwright.config.test.ts`

**Interfaces:**

- Consumes: the default exports from root `vitest.config.ts` and `playwright.config.ts`.
- Produces: the same configuration assertions under the common `tests/config/` boundary; no production interface changes.

- [ ] **Step 1: Establish the configuration-test baseline**

Run: `pnpm test -- vite.config.test.ts playwright.config.test.ts`

Expected: both files pass before they move. Record any pre-existing failure and do not attribute it to cleanup.

- [ ] **Step 2: Move the two test files and update their imports**

Use Git-aware moves. In `tests/config/vitest.config.test.ts`, import `../../vitest.config`. In `tests/config/playwright.config.test.ts`, import `../../playwright.config`. Keep the existing assertions unchanged.

- [ ] **Step 3: Verify test discovery at the new paths**

Run: `pnpm test -- tests/config/vitest.config.test.ts tests/config/playwright.config.test.ts`

Expected: both files pass, with the existing Vitest exclusions and `390 x 844` Playwright project assertions intact.

- [ ] **Step 4: Commit the test organization change**

```bash
git add vite.config.test.ts playwright.config.test.ts tests/config
git commit -m "test: organize configuration checks"
```

---

### Task 2: Relocate Offline Evaluation Tooling

**Files:**

- Move: `evaluation/` -> `tools/evaluation/`
- Modify: `tools/evaluation/actualTop3FromAnalysisResult.ts`
- Modify: `tools/evaluation/actualTop3FromAnalysisResult.test.ts`
- Modify: `tools/evaluation/directionCodes.test.ts`
- Modify: `package.json`
- Modify: `README.md`

**Interfaces:**

- Consumes: `AnalysisResult`, composed feedback, and the exported rule collections under `src/`.
- Produces: the unchanged `actualTop3FromAnalysisResult`, `labelledCaseSchema`, `directionCodeForRule`, and `scoreAgreement` evaluation APIs from `tools/evaluation/`.

- [ ] **Step 1: Establish the agreement-tool baseline**

Run: `pnpm test:agreement && pnpm test -- evaluation`

Expected: the agreement test and all evaluation tests pass before the move.

- [ ] **Step 2: Move the evaluation directory**

Use a Git-aware move from `evaluation/` to `tools/evaluation/`. Preserve every TypeScript file, test, and the review protocol.

- [ ] **Step 3: Repair source-relative imports**

Change imports that previously used `../src/...` to `../../src/...`. Keep sibling imports such as `./dataset.schema` and `./directionCodes` unchanged.

- [ ] **Step 4: Update executable and documentation paths**

Set `test:agreement` in `package.json` to `vitest run tools/evaluation/scoreAgreement.test.ts`. Change the README product-acceptance link to `tools/evaluation/README.md`.

- [ ] **Step 5: Verify the relocated tool boundary**

Run: `pnpm test:agreement && pnpm test -- tools/evaluation`

Expected: all evaluation tests pass from the new path, including five-position schema coverage and the inclusive `0.8` agreement target.

- [ ] **Step 6: Commit the evaluation move**

```bash
git add evaluation tools/evaluation package.json README.md
git commit -m "refactor: organize offline evaluation tools"
```

---

### Task 3: Produce a Provider-Neutral Static Build

**Files:**

- Create: `tests/config/siteMetadata.test.ts`
- Modify: `index.html`
- Modify: `vite.config.ts`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `pnpm-workspace.yaml`
- Modify: `.gitignore`
- Delete: `.openai/hosting.json`
- Delete: `worker/index.ts`
- Delete: `wrangler.jsonc`

**Interfaces:**

- Consumes: the existing React entry point `src/main.tsx` and `scripts/sync-mediapipe-assets.mjs` prebuild contract.
- Produces: a conventional Vite `dist/index.html` build whose canonical URL is `https://aligneballet.online/` and whose social image is `https://aligneballet.online/og.png`.

- [ ] **Step 1: Write the failing metadata test**

Create `tests/config/siteMetadata.test.ts` using `readFileSync(new URL('../../index.html', import.meta.url), 'utf8')`. Add one test that asserts exact tags for:

- `<link rel="canonical" href="https://aligneballet.online/" />`
- `<meta property="og:url" content="https://aligneballet.online/" />`
- Open Graph image `https://aligneballet.online/og.png`
- Twitter image `https://aligneballet.online/og.png`

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');

describe('site metadata', () => {
  it('uses the production domain for canonical and social URLs', () => {
    expect(html).toContain('<link rel="canonical" href="https://aligneballet.online/" />');
    expect(html).toContain('<meta property="og:url" content="https://aligneballet.online/" />');
    expect(html).toContain('<meta property="og:image" content="https://aligneballet.online/og.png" />');
    expect(html).toContain('<meta name="twitter:image" content="https://aligneballet.online/og.png" />');
  });
});
```

- [ ] **Step 2: Run the metadata test and confirm the intended failure**

Run: `pnpm test -- tests/config/siteMetadata.test.ts`

Expected: FAIL because the canonical and `og:url` tags are absent and social images still use the old host.

- [ ] **Step 3: Update `index.html` metadata**

Add the canonical and `og:url` tags and replace both social-image URLs with the exact production-domain URL. Do not change the visible title or description in this cleanup.

- [ ] **Step 4: Simplify the Vite build boundary**

Remove the hosted-site and worker-adapter imports and calls from `vite.config.ts`. Keep `defineConfig({ plugins: [react()] })` as the complete production configuration.

- [ ] **Step 5: Remove obsolete hosting files and dependencies**

Delete the three tracked hosting files listed above. Remove `@cloudflare/vite-plugin`, `@cloudflare/workers-types`, `@openai/sites-vite-plugin`, and `wrangler`. Move `zod` from `dependencies` to `devDependencies` because only `tools/evaluation/` imports it. Keep all remaining version ranges unchanged.

- [ ] **Step 6: Regenerate package-manager state**

Run: `pnpm install --lockfile-only`

Expected: the lockfile no longer resolves the removed hosting adapters, worker runtime, or their transitive platform binaries.

Set `pnpm-workspace.yaml` `allowBuilds` to `esbuild: true` only. Remove the retired worker-state entry from `.gitignore`. Before removing the tracked `.superpowers/` ignore entry, add it to `.git/info/exclude` for this checkout so local tool state remains untouched and untracked.

- [ ] **Step 7: Verify metadata and static build output**

Run: `pnpm test -- tests/config/siteMetadata.test.ts && pnpm build`

Expected: PASS; `dist/index.html` exists, while `dist/server/`, `dist/client/`, and `dist/.openai/` do not.

Run: `test -f dist/models/pose_landmarker_heavy.task && test -d dist/vendor/mediapipe/wasm`

Expected: exit status `0`.

- [ ] **Step 8: Commit the static-build cleanup**

```bash
git add .gitignore index.html vite.config.ts package.json pnpm-lock.yaml pnpm-workspace.yaml tests/config/siteMetadata.test.ts
git add -u .openai worker wrangler.jsonc
git commit -m "build: target provider-neutral static hosting"
```

---

### Task 4: Consolidate Public Project Documentation

**Files:**

- Modify: `docs/architecture.md`
- Move: `docs/superpowers/plans/*.md` -> `docs/implementation-plans/`
- Modify: `docs/implementation-plans/*.md`
- Delete: `docs/superpowers/specs/*.md`
- Delete: tracked `.DS_Store` files under `docs/`
- Modify: `README.md`

**Interfaces:**

- Consumes: the approved cleanup architecture plus the useful technical decisions in the three historical design documents.
- Produces: one current architecture reference, four preserved implementation plans, valid README links, and no public dependency on an agent-specific documentation layout.

- [ ] **Step 1: Record the documentation baseline**

Run: `find docs/superpowers -type f ! -name '.DS_Store' | sort`

Expected: three implementation plans and three design documents are present, including any currently untracked refined-pose documents. Do not proceed if one is missing.

- [ ] **Step 2: Enrich the consolidated architecture document**

Add concise sections to `docs/architecture.md` covering these retained technical decisions:

- five supported positions and their front or three-quarter view requirements;
- browser-only privacy boundary and in-memory photo lifecycle;
- image limits: `12 MiB`, reject shortest side below `480 px`, resize longest side above `4096 px`;
- Heavy-model two-pass detection, `numPoses: 2`, `0.60` landmark score floor, `48 px` torso floor, `180 px` visible-extent floor, and `20%` crop padding;
- cross-pass disagreement limits of `0.12` torso lengths for major joints and `0.18` for face, hands, and feet;
- reliability -> measurements -> position rules -> deterministic feedback -> annotations module boundaries;
- conservative Top 3 policy and the `80%` real-photo agreement acceptance target.

Correct the stray `µµ-` list marker while incorporating the refined-pose design. Do not copy superseded prose or duplicate sequential status sections.

- [ ] **Step 3: Move and normalize the implementation plans**

Move the three historical plans into `docs/implementation-plans/` beside this plan. Update moved evaluation paths to `tools/evaluation/` and replace old spec links with `docs/architecture.md`.

After the cleanup tasks have been executed, replace agent-only execution headers in the three historical plans with `**Status:** Historical implementation record` and in this plan with `**Status:** Approved cleanup plan`. In this plan's completed Task 3 narrative, replace explicit retired-provider package/path names with the generic terms “legacy hosted-site adapter,” “worker adapter,” and “legacy hosting metadata” so obsolete branding is not retained in the public documentation.

- [ ] **Step 4: Remove redundant design copies and metadata files**

Delete the three old design documents only after their retained decisions appear in `docs/architecture.md`. Remove tracked `.DS_Store` files. Remove the empty `docs/superpowers/` hierarchy.

- [ ] **Step 5: Update README navigation and deployment guidance**

Add links to `docs/architecture.md` and `docs/implementation-plans/`. Add a short deployment section stating that `pnpm build` produces `dist/` and that the production site is served from Alibaba Cloud at `https://aligneballet.online/`. Do not claim that running a build automatically publishes to the live server.

- [ ] **Step 6: Verify documentation structure and links**

Run: `find docs -maxdepth 2 -type f | sort`

Expected: `architecture.md`, four files in `implementation-plans/`, and four README screenshots in `images/`; no `docs/superpowers/` files remain.

Run: `rg -n 'docs/superpowers|\]\(evaluation/' README.md docs tools package.json || true`

Expected: no matches.

- [ ] **Step 7: Commit the documentation consolidation**

```bash
git add README.md docs tools/evaluation/README.md
git commit -m "docs: consolidate project architecture and plans"
```

---

### Task 5: Run Full Regression and Repository Verification

**Files:**

- Modify only if a verification failure demonstrates a cleanup regression; use the owning task's files and tests.
- Do not change product logic to make cleanup checks pass.

**Interfaces:**

- Consumes: the reorganized repository produced by Tasks 1-4.
- Produces: evidence that the current application, offline tooling, documentation, and production build remain functional.

- [ ] **Step 1: Verify a reproducible dependency install**

Run: `pnpm install --frozen-lockfile`

Expected: exit status `0` with no lockfile changes.

- [ ] **Step 2: Run unit, component, configuration, and evaluation tests**

Run: `pnpm test && pnpm test:agreement`

Expected: all tests pass, including five-position rules, metadata, configuration, and agreement scoring.

- [ ] **Step 3: Build the production site and inspect its shape**

Run: `pnpm build`

Expected: TypeScript and Vite exit `0`; `dist/index.html`, `dist/models/pose_landmarker_heavy.task`, and `dist/vendor/mediapipe/wasm/` exist; there is no server bundle or provider metadata in `dist/`.

- [ ] **Step 4: Run browser regression checks**

Run: `pnpm test:e2e`

Expected: Chromium phone and Mobile Safari projects pass at `390 x 844`, covering selection, framing, photo checks, analysis, result display, annotation download, privacy, and accessibility assertions already present in the suite.

- [ ] **Step 5: Smoke-test the built site**

Run `pnpm exec vite preview --host 127.0.0.1 --port 4173`, open the preview, and complete one supported-position flow through annotated-image download. Confirm the browser network panel loads the Heavy model and MediaPipe WebAssembly from `/models/` and `/vendor/mediapipe/wasm/` without requests to a retired host.

- [ ] **Step 6: Audit repository presentation**

Construct the legacy-brand search pattern from split strings so the completed plan itself does not preserve the retired names, then search all tracked files case-insensitively:

```bash
legacy_brand_pattern="$(printf '%s|%s|%s|%s' 'open''ai' 'chat''gpt' 'cloud''flare' 'wrang''ler')"
git grep -niE "$legacy_brand_pattern"
```

Also run: `rg -n 'docs/superpowers|stony-charm-2588' . --hidden --glob '!.git/**' --glob '!docs/implementation-plans/**'`

Expected: no matches in active source, configuration, README, or architecture documentation. Historical implementation plans may describe their former paths but must not contain retired provider branding.

Run: `git diff --check`

Expected: no whitespace errors.

- [ ] **Step 7: Review the final diff and commit verification-only corrections**

Run: `git status --short && git diff --stat && git log --oneline -5`

Expected: every cleanup change belongs to Tasks 1-4, the pre-existing feature work remains accounted for, and no generated `dist/`, model, WebAssembly, cache, report, or participant-photo file is staged.

If verification required a cleanup-only correction, commit it with:

```bash
git add <only-the-corrected-cleanup-files>
git commit -m "fix: complete repository cleanup verification"
```

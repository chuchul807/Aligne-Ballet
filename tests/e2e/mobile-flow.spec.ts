import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { BodyRegion, CorrectionFeedbackItem, FullBodySection, Landmark, MeasurementSet } from '../../src/domain/types';

async function useFakeServices(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    const stableLandmarks: Landmark[] = [
      { name: 'nose', x: 0.5, y: 0.1, visibility: 0.9 },
      { name: 'left_eye_inner', x: 0.47, y: 0.1, visibility: 0.9 },
      { name: 'left_eye', x: 0.475, y: 0.1, visibility: 0.9 },
      { name: 'left_eye_outer', x: 0.48, y: 0.1, visibility: 0.9 },
      { name: 'right_eye_inner', x: 0.52, y: 0.1, visibility: 0.9 },
      { name: 'right_eye', x: 0.525, y: 0.1, visibility: 0.9 },
      { name: 'right_eye_outer', x: 0.53, y: 0.1, visibility: 0.9 },
      { name: 'left_ear', x: 0.46, y: 0.12, visibility: 0.9 },
      { name: 'right_ear', x: 0.54, y: 0.12, visibility: 0.9 },
      { name: 'mouth_left', x: 0.48, y: 0.14, visibility: 0.9 },
      { name: 'mouth_right', x: 0.52, y: 0.14, visibility: 0.9 },
      { name: 'left_shoulder', x: 0.4, y: 0.3, visibility: 0.9 },
      { name: 'right_shoulder', x: 0.6, y: 0.3, visibility: 0.9 },
      { name: 'left_elbow', x: 0.3, y: 0.38, visibility: 0.9 },
      { name: 'right_elbow', x: 0.7, y: 0.38, visibility: 0.9 },
      { name: 'left_wrist', x: 0.2, y: 0.46, visibility: 0.9 },
      { name: 'right_wrist', x: 0.8, y: 0.46, visibility: 0.9 },
      { name: 'left_pinky', x: 0.19, y: 0.46, visibility: 0.9 },
      { name: 'right_pinky', x: 0.81, y: 0.46, visibility: 0.9 },
      { name: 'left_index', x: 0.2, y: 0.45, visibility: 0.9 },
      { name: 'right_index', x: 0.8, y: 0.45, visibility: 0.9 },
      { name: 'left_thumb', x: 0.2, y: 0.47, visibility: 0.9 },
      { name: 'right_thumb', x: 0.8, y: 0.47, visibility: 0.9 },
      { name: 'left_hip', x: 0.4, y: 0.7, visibility: 0.9 },
      { name: 'right_hip', x: 0.6, y: 0.7, visibility: 0.9 },
      { name: 'left_knee', x: 0.4, y: 0.85, visibility: 0.9 },
      { name: 'right_knee', x: 0.6, y: 0.85, visibility: 0.9 },
      { name: 'left_ankle', x: 0.4, y: 0.95, visibility: 0.9 },
      { name: 'right_ankle', x: 0.6, y: 0.95, visibility: 0.9 },
      { name: 'left_heel', x: 0.38, y: 0.96, visibility: 0.9 },
      { name: 'right_heel', x: 0.62, y: 0.96, visibility: 0.9 },
      { name: 'left_foot_index', x: 0.36, y: 0.94, visibility: 0.9 },
      { name: 'right_foot_index', x: 0.64, y: 0.94, visibility: 0.9 },
    ];
    const completeMeasurement = (value = 1) => ({
      value,
      confidence: 'high' as const,
      assessability: 'assessable' as const,
      evidence: [],
    });
    const completeMeasurements: MeasurementSet = {
      torsoLength: completeMeasurement(),
      supportingKneeAngle: completeMeasurement(),
      supportingKneeForwardDepthCue: completeMeasurement(),
      workingKneeAngle: completeMeasurement(),
      workingKneeForwardDepthCue: completeMeasurement(),
      pelvisSlope: completeMeasurement(),
      shoulderSlope: completeMeasurement(),
      torsoLateralOffset: completeMeasurement(),
      workingAnkleToSupportingKnee: completeMeasurement(),
      workingKneeLateralOffset: completeMeasurement(),
      workingKneeHeightFromHip: completeMeasurement(),
      workingAnkleHeightFromHip: completeMeasurement(),
      workingFootPointAngle: completeMeasurement(),
      workingHeelDepthCue: completeMeasurement(),
      workingHeelVisibilityCue: completeMeasurement(),
      workingAnkleOutwardOffset: completeMeasurement(),
      workingFootHeightFromSupportingFoot: completeMeasurement(),
      croiseCrossingSeparation: completeMeasurement(),
      frontalSupportingHipAnkleOffset: completeMeasurement(),
      leftElbowAngle: completeMeasurement(),
      rightElbowAngle: completeMeasurement(),
      headTiltFromTorso: completeMeasurement(),
    };
    const refined = {
      status: 'success' as const,
      landmarks: { people: [stableLandmarks], sourceWidth: 2048, sourceHeight: 4096 },
      disagreements: new Set<Landmark['name']>(),
    };
    const correction: CorrectionFeedbackItem = {
      observationId: 'synthetic-pelvis-unlevel',
      ruleId: 'pelvis-unlevel',
      text: 'The pelvis appears uneven in this photo. Gently level the hip line.',
      region: 'pelvis',
      priority: 'structure',
      confidence: 'high',
      direction: 'level the hip line',
    };
    const regions: BodyRegion[] = ['supporting-leg', 'working-leg', 'pelvis', 'torso', 'shoulders-arms', 'head', 'feet'];
    const fullBodyReview: FullBodySection[] = regions.map((region) => ({
      region,
      status: region === 'head' ? 'unassessable' : region === 'pelvis' ? 'finding' : 'clear',
      items: region === 'pelvis' ? [correction] : [{
        observationId: `synthetic-${region}`,
        text: region === 'head'
          ? 'Not enough evidence in this photo to recommend a change.'
          : 'No visible issue found in this view.',
        region,
        priority: 'line',
        confidence: region === 'head' ? 'medium' : 'high',
      }],
    }));
    (window as Window & { __ALIGNE_TEST_SERVICES__?: unknown }).__ALIGNE_TEST_SERVICES__ = {
      createDetector: async () => ({ detect: async () => ({ people: [stableLandmarks], sourceWidth: 2048, sourceHeight: 4096 }), close: () => {} }),
      now: () => '2026-09-03T12:00:00.000Z',
      analysis: {
        decode: async () => {
          const source = document.createElement('canvas');
          source.width = 2048;
          source.height = 4096;
          return {
            source, width: 2048, height: 4096,
            normalisation: { wasResized: true, originalWidth: 4096, originalHeight: 8192 },
            dispose: () => {},
          };
        },
        metrics: () => ({ meanLuminance: 0.5, contrast: 0.2, edgeEnergy: 0.1 }),
        quality: () => ({ status: 'partial', reasons: [], unassessableRegions: ['head'] }),
        refine: async () => {
          const testWindow = window as Window & {
            __DEFER_REFINEMENT__?: boolean;
            __RESOLVE_REFINEMENT__?: () => void;
          };
          if (testWindow.__DEFER_REFINEMENT__) {
            await new Promise<void>((resolve) => { testWindow.__RESOLVE_REFINEMENT__ = resolve; });
          }
          return refined;
        },
        measure: () => completeMeasurements,
        evaluate: () => [],
        feedback: () => ({ topCorrections: [correction], fullBodyReview }),
        annotations: () => [],
      },
    };
  });
}

async function unlockFrame(page: import('@playwright/test').Page) {
  await page.getByRole('radio', { name: 'Arabesque' }).check();
  await page.getByRole('radio', { name: 'Left' }).check();
  await page.getByRole('button', { name: 'Continue to framing' }).click();
}

async function analyzeFixture(page: import('@playwright/test').Page) {
  await page.getByLabel('Choose a photo').setInputFiles({ name: 'synthetic-fixture.png', mimeType: 'image/png', buffer: Buffer.from('synthetic fixture') });
  await page.getByRole('button', { name: 'Analyse position' }).click();
}

test.beforeEach(async ({ page }) => {
  await useFakeServices(page);
});

test('shows one stage card and unlocks Frame only after selection while Result remains locked before success', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('main.app-card > section:visible')).toHaveCount(1);
  await expect(page.getByRole('tab', { name: 'Frame' })).toBeDisabled();
  await expect(page.getByRole('tab', { name: 'Result' })).toBeDisabled();

  await unlockFrame(page);
  await page.getByRole('tab', { name: 'Frame' }).focus();
  await page.getByRole('tab', { name: 'Frame' }).press('Enter');

  await expect(page.getByRole('heading', { name: 'Three-quarter side guide' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Result' })).toBeDisabled();
  await expect(page.locator('main.app-card > section:visible')).toHaveCount(1);
});

test('has no serious or critical accessibility violations', async ({ page }) => {
  await page.goto('/');

  const results = await new AxeBuilder({ page }).analyze();

  expect(results.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? ''))).toEqual([]);
});

test('shows resized-photo guidance and one supported correction without filling uncertain regions', async ({ page }) => {
  await page.goto('/');
  await unlockFrame(page);
  await page.getByLabel('Choose a photo').setInputFiles({ name: 'synthetic-fixture.png', mimeType: 'image/png', buffer: Buffer.from('synthetic fixture') });

  await expect(page.getByText('Large photo resized for analysis. Its proportions were preserved.')).toBeVisible();
  await expect(page.locator('main.app-card > section:visible')).toHaveCount(1);
  await page.getByRole('button', { name: 'Analyse position' }).click();
  await expect(page.getByLabel('Your feedback')).toBeVisible();
  await expect(page.locator('.corrections > li')).toHaveCount(1);
  await expect(page.getByText('Not enough evidence in this photo to recommend a change.')).toBeVisible();
  await expect(page.locator('main.app-card > section:visible')).toHaveCount(1);

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? ''))).toEqual([]);
});

test('keeps a synthetic fixture in memory without persistence or POST requests after services are ready', async ({ page }) => {
  await page.goto('/');
  await unlockFrame(page);
  await page.evaluate(() => {
    const calls: { localStorage: number; indexedDB: number; posts: number } = { localStorage: 0, indexedDB: 0, posts: 0 };
    const originalFetch = window.fetch.bind(window);
    Object.defineProperty(window, '__privacyCalls__', { value: calls, configurable: true });
    window.localStorage.setItem = () => { calls.localStorage += 1; };
    indexedDB.open = () => { calls.indexedDB += 1; throw new Error('indexedDB must not be used'); };
    window.fetch = async (input, init) => {
      const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
      if (method.toUpperCase() === 'POST') calls.posts += 1;
      return originalFetch(input, init);
    };
  });

  await analyzeFixture(page);

  await expect(page.getByLabel('Your feedback')).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as Window & { __privacyCalls__: { localStorage: number; indexedDB: number; posts: number } }).__privacyCalls__)).toEqual({ localStorage: 0, indexedDB: 0, posts: 0 });
});

test('keeps the analysing status visible while refinement is deferred, then shows the check card', async ({ page }) => {
  await page.goto('/');
  await unlockFrame(page);
  await page.evaluate(() => { (window as Window & { __DEFER_REFINEMENT__?: boolean }).__DEFER_REFINEMENT__ = true; });
  await page.getByLabel('Choose a photo').setInputFiles({ name: 'synthetic-fixture.png', mimeType: 'image/png', buffer: Buffer.from('synthetic fixture') });

  await expect(page.getByRole('status')).toHaveText('Checking your photo…');
  await expect.poll(() => page.evaluate(() => typeof (window as Window & { __RESOLVE_REFINEMENT__?: () => void }).__RESOLVE_REFINEMENT__)).toBe('function');
  await expect(page.getByRole('status')).toBeVisible();

  await page.evaluate(() => { (window as Window & { __RESOLVE_REFINEMENT__?: () => void }).__RESOLVE_REFINEMENT__?.(); });
  await expect(page.getByRole('heading', { name: 'Photo check partially passed' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Analyse position' })).toBeEnabled();
});

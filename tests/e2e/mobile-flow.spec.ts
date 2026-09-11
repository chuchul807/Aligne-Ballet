import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import type { BodyRegion, CorrectionFeedbackItem, FullBodySection } from '../../src/domain/types';

async function useFakeServices(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
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
      createDetector: async () => ({ detect: async () => ({ people: [[]], sourceWidth: 2048, sourceHeight: 4096 }), close: () => {} }),
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
        quality: () => ({ status: 'pass', reasons: [], unassessableRegions: ['head'] }),
        measure: () => ({}),
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

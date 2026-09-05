import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

async function useFakeServices(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    const fullBodyReview = ['supporting-leg', 'working-leg', 'pelvis', 'torso', 'shoulders-arms', 'head', 'feet'].map((region) => ({ region, status: 'clear', items: [] }));
    (window as Window & { __ALIGNE_TEST_SERVICES__?: unknown }).__ALIGNE_TEST_SERVICES__ = {
      createDetector: async () => ({ detect: async () => ({ people: [[]], sourceWidth: 1000, sourceHeight: 1500 }), close: () => {} }),
      now: () => '2026-09-03T12:00:00.000Z',
      analysis: {
        decode: async () => {
          const source = document.createElement('canvas');
          source.width = 1000;
          source.height = 1500;
          return { source, width: 1000, height: 1500, dispose: () => {} };
        },
        metrics: () => ({ meanLuminance: 0.5, contrast: 0.2, edgeEnergy: 0.1 }),
        quality: () => ({ status: 'pass', reasons: [], unassessableRegions: [] }),
        measure: () => ({}),
        evaluate: () => [],
        feedback: () => ({ topCorrections: [], fullBodyReview }),
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

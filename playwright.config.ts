import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  use: { baseURL: 'http://127.0.0.1:4173' },
  webServer: {
    command: 'pnpm exec vite --mode e2e --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
  },
  projects: [
    { name: 'chromium-phone', use: { browserName: 'chromium', viewport: { width: 390, height: 844 } } },
    { name: 'mobile-safari', use: { ...devices['iPhone 13'], browserName: 'webkit', viewport: { width: 390, height: 844 }, screen: { width: 390, height: 844 } } },
  ],
});

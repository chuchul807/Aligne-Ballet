import { describe, expect, it } from 'vitest';
import config from './playwright.config';

describe('Playwright phone projects', () => {
  it('pins both Chromium and Mobile Safari to the 390 by 844 acceptance viewport', () => {
    for (const name of ['chromium-phone', 'mobile-safari']) {
      const project = config.projects?.find((candidate) => candidate.name === name);
      expect(project?.use?.viewport).toEqual({ width: 390, height: 844 });
    }
  });

  it('starts Vite in explicit e2e mode', () => {
    expect(config.webServer).toMatchObject({ command: expect.stringContaining('--mode e2e') });
  });
});

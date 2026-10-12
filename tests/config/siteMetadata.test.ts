import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');
const readme = readFileSync(resolve(process.cwd(), 'README.md'), 'utf8');

describe('site metadata', () => {
  it('uses the production domain for canonical and social URLs', () => {
    expect(html).toContain('<link rel="canonical" href="https://aligneballet.online/" />');
    expect(html).toContain('<meta property="og:url" content="https://aligneballet.online/" />');
    expect(html).toContain('<meta property="og:image" content="https://aligneballet.online/og.png" />');
    expect(html).toContain('<meta name="twitter:image" content="https://aligneballet.online/og.png" />');
  });

  it('documents the same Heavy pose model that the production build bundles', () => {
    expect(readme).toContain('MediaPipe Pose Landmarker Heavy');
    expect(readme).not.toContain('Pose Landmarker Lite');
  });

  it('publishes the project under the noncommercial license selected by the owner', () => {
    const licensePath = resolve(process.cwd(), 'LICENSE');

    expect(existsSync(licensePath)).toBe(true);
    const license = readFileSync(licensePath, 'utf8');
    expect(license).toContain('PolyForm Noncommercial License 1.0.0');
    expect(license).toContain('Required Notice: Copyright 2026 chuchul807');
    expect(license).not.toContain('Apache License');
    expect(readme).toContain('PolyForm Noncommercial 1.0.0');
  });
});

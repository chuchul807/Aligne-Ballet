import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8');

describe('site metadata', () => {
  it('uses the production domain for canonical and social URLs', () => {
    expect(html).toContain('<link rel="canonical" href="https://aligneballet.online/" />');
    expect(html).toContain('<meta property="og:url" content="https://aligneballet.online/" />');
    expect(html).toContain('<meta property="og:image" content="https://aligneballet.online/og.png" />');
    expect(html).toContain('<meta name="twitter:image" content="https://aligneballet.online/og.png" />');
  });
});

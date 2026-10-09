import { describe, expect, it } from 'vitest';
import config from './vitest.config';

describe('Vitest discovery boundaries', () => {
  it('ignores repository-local worktrees and package-store snapshots', () => {
    const excluded = Array.isArray(config.test?.exclude) ? config.test.exclude : [];

    expect(excluded).toEqual(expect.arrayContaining(['.worktrees/**', '.pnpm-store/**']));
  });
});

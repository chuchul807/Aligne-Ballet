import { describe, expect, it } from 'vitest';
import { labelledCaseSchema } from './dataset.schema';

describe('labelledCaseSchema', () => {
  it.each(['a-la-seconde', 'tendu-croise-devant'] as const)('accepts the %s evaluation position', (position) => {
    const parsed = labelledCaseSchema.parse({
      id: `case-${position}`,
      position,
      supportingSide: 'left',
      assessable: true,
      expectedTop3: [],
      actualTop3: [],
    });

    expect(parsed.position).toBe(position);
  });
});

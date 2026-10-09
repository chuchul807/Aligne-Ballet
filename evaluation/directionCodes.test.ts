import { describe, expect, it } from 'vitest';
import { COMMON_RULES } from '../src/rules/commonRules';
import { ARABESQUE_RULES } from '../src/rules/arabesqueRules';
import { ATTITUDE_RULES } from '../src/rules/attitudeRules';
import { RETIRE_RULES } from '../src/rules/retireRules';
import { A_LA_SECONDE_RULES } from '../src/rules/aLaSecondeRules';
import { TENDU_CROISE_RULES } from '../src/rules/tenduCroiseRules';
import { directionCodeForRule, DIRECTION_CODE_BY_RULE_ID } from './directionCodes';

describe('evaluation direction codebook', () => {
  it('covers exactly every exported rule with a unique kebab-case adjustment direction', () => {
    const ruleIds = [
      ...COMMON_RULES,
      ...ARABESQUE_RULES,
      ...ATTITUDE_RULES,
      ...RETIRE_RULES,
      ...A_LA_SECONDE_RULES,
      ...TENDU_CROISE_RULES,
    ].map((rule) => rule.id).sort();
    const entries = Object.entries(DIRECTION_CODE_BY_RULE_ID);
    const codes = entries.map(([, code]) => code);

    expect(Object.keys(DIRECTION_CODE_BY_RULE_ID).sort()).toEqual(ruleIds);
    expect(new Set(codes).size).toBe(codes.length);
    for (const code of codes) expect(code).toMatch(/^[a-z]+(?:-[a-z]+)*$/);
    expect(directionCodeForRule('supporting-knee-bent')).toBe('straighten-supporting-knee');
  });
});

export const DIRECTION_CODE_BY_RULE_ID = {
  'supporting-knee-bent': 'straighten-supporting-knee',
  'pelvis-unlevel': 'level-pelvis',
  'shoulders-unlevel': 'lower-raised-shoulder',
  'torso-off-support': 'align-torso-over-support',
  'supporting-lateral-offset': 'align-supporting-hip-and-ankle-laterally',
  'left-arm-line-collapsed': 'lengthen-left-arm',
  'right-arm-line-collapsed': 'lengthen-right-arm',
  'head-extreme-lateral-tilt': 'align-head-with-torso',
  'arabesque-working-knee-bent': 'straighten-arabesque-working-leg',
  'arabesque-lower-leg-for-pelvis': 'lower-working-leg-and-level-pelvis',
  'arabesque-working-leg-too-low': 'lift-arabesque-working-leg',
  'arabesque-torso-collapse': 'lengthen-arabesque-torso-forward-and-upward',
  'attitude-working-knee-too-straight': 'bend-attitude-working-knee',
  'attitude-working-knee-too-closed': 'open-attitude-working-knee-bend',
  'attitude-level-pelvis': 'level-attitude-pelvis',
  'attitude-lift-thigh': 'lift-attitude-working-thigh',
  'retire-place-foot-at-knee': 'place-retire-foot-at-supporting-knee',
  'retire-open-working-knee': 'move-retire-working-knee-outward',
  'a-la-seconde-working-knee-bent': 'straighten-a-la-seconde-working-leg',
  'a-la-seconde-working-leg-not-side': 'move-a-la-seconde-working-leg-sideways',
  'a-la-seconde-foot-not-pointed': 'point-a-la-seconde-working-foot',
  'a-la-seconde-turnout-not-visible': 'show-a-la-seconde-turned-out-heel',
  'a-la-seconde-pelvis-out-of-line': 'restore-a-la-seconde-pelvic-line',
  'tendu-working-knee-bent': 'straighten-tendu-working-leg',
  'tendu-foot-not-pointed': 'point-tendu-working-foot',
  'tendu-working-foot-lifted': 'lower-tendu-working-toes',
  'tendu-crossing-too-small': 'increase-tendu-croise-crossing',
} as const;

export type DirectionCode = typeof DIRECTION_CODE_BY_RULE_ID[keyof typeof DIRECTION_CODE_BY_RULE_ID];

/** Returns the canonical review code for a known evaluated rule. */
export function directionCodeForRule(ruleId: string): DirectionCode {
  const code = DIRECTION_CODE_BY_RULE_ID[ruleId as keyof typeof DIRECTION_CODE_BY_RULE_ID];
  if (!code) throw new Error(`No canonical evaluation direction code for rule: ${ruleId}`);
  return code;
}

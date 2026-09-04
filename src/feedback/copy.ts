export interface FeedbackCopyVariants {
  high: string;
  medium: string;
}

export const FEEDBACK_COPY = {
  'supporting-knee-bent': { high: 'Straighten your supporting knee.', medium: 'Your supporting knee appears slightly bent; try lengthening it.' },
  'pelvis-unlevel': { high: 'Level your pelvis before increasing the leg height.', medium: 'Your pelvis may be lifting on the working side; try bringing it level.' },
  'shoulders-unlevel': { high: 'Lower the raised shoulder slightly.', medium: 'One shoulder appears higher; soften it downward.' },
  'torso-off-support': { high: 'Bring your torso back over your supporting side.', medium: 'Your torso appears slightly off your supporting side; bring it back toward centre.' },
  'supporting-ankle-not-stacked': { high: 'Stack your supporting hip more directly over your ankle.', medium: 'Your supporting hip may be drifting away from your ankle; bring them closer into line.' },
  'left-arm-line-collapsed': { high: 'Lengthen through your left elbow to restore the arm line.', medium: 'Your left elbow appears compressed; lengthen gently through the arm.' },
  'right-arm-line-collapsed': { high: 'Lengthen through your right elbow to restore the arm line.', medium: 'Your right elbow appears compressed; lengthen gently through the arm.' },
  'head-extreme-lateral-tilt': { high: 'Bring your head closer to the line of your torso.', medium: 'Your head appears strongly tilted; bring it slightly closer to your torso line.' },
  'arabesque-working-knee-bent': { high: 'Lengthen and straighten your working leg.', medium: 'Your working knee appears slightly bent; lengthen through the leg.' },
  'arabesque-lower-leg-for-pelvis': { high: 'Lower your working leg slightly and re-level your pelvis.', medium: 'Your pelvis may be lifting with the leg; lower the leg slightly and re-level it.' },
  'arabesque-working-leg-too-low': { high: 'Lengthen your working leg back and slightly upward without changing your pelvis.', medium: 'Your working leg may be dropping; reach it back and slightly upward while keeping the pelvis level.' },
  'arabesque-torso-collapse': { high: 'Lengthen your torso forward and upward.', medium: 'Your torso appears compressed; lengthen forward and upward.' },
  'attitude-working-knee-too-straight': { high: 'Soften your working knee into a clearer attitude shape.', medium: 'Your working knee appears nearly straight; soften it into the attitude shape.' },
  'attitude-working-knee-too-closed': { high: 'Open the angle behind your working knee slightly.', medium: 'The angle behind your working knee may be too closed; open it slightly.' },
  'attitude-level-pelvis': { high: 'Lower your working leg slightly and level your pelvis.', medium: 'Your pelvis may be lifting with the thigh; lower the leg slightly and re-level it.' },
  'attitude-lift-thigh': { high: 'Lift your working thigh slightly while keeping your pelvis level.', medium: 'Your working thigh appears low; lift it slightly without changing the pelvis.' },
  'retire-place-foot-at-knee': { high: 'Bring your working foot closer to the supporting knee.', medium: 'Your working foot appears away from the supporting knee; bring it closer.' },
  'retire-open-working-knee': { high: 'Move your working knee farther to the side without shifting your pelvis.', medium: 'Your working knee may be too far forward; move it slightly farther to the side.' },
  'retire-keep-pelvis-level': { high: 'Level your pelvis over the supporting leg.', medium: 'Your pelvis appears uneven; bring it closer to level over the supporting leg.' },
  'retire-stack-over-support': { high: 'Bring your pelvis more directly over your supporting ankle.', medium: 'Your balance may be drifting from the supporting ankle; bring your pelvis toward it.' },
} satisfies Record<string, FeedbackCopyVariants>;

export function feedbackCopyFor(ruleId: string, confidence: 'high' | 'medium'): string {
  const copy = (FEEDBACK_COPY as Record<string, FeedbackCopyVariants>)[ruleId];
  if (copy === undefined) {
    throw new Error(`Missing approved feedback copy for rule: ${ruleId}`);
  }
  return copy[confidence];
}

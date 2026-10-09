export interface FeedbackCopyVariants {
  high: string;
  medium: string;
}

const UNSAFE_FEEDBACK_TEXT = /\b(?:pain|injury|diagnose|engage\s+your|degrees?|percent(?:age)?s?)\b|[°%]/i;

export function isSafeFeedbackText(text: string): boolean {
  return !UNSAFE_FEEDBACK_TEXT.test(text);
}

export const FEEDBACK_COPY = {
  'supporting-knee-bent': { high: 'Straighten your supporting knee.', medium: 'Your supporting knee appears slightly bent; try lengthening it.' },
  'pelvis-unlevel': { high: 'From this view, level the visible line of your pelvis.', medium: 'From this view, your pelvis may appear uneven.' },
  'shoulders-unlevel': { high: 'Lower the raised shoulder slightly.', medium: 'One shoulder appears higher; soften it downward.' },
  'torso-off-support': { high: 'Bring your torso back over your supporting side.', medium: 'Your torso appears slightly off your supporting side; bring it back toward centre.' },
  'supporting-lateral-offset': { high: 'From this front view, bring your supporting hip and ankle into closer side-to-side alignment.', medium: 'There is not enough evidence to confirm your side-to-side support alignment.' },
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
  'retire-open-working-knee': { high: 'From this front view, move your visible working knee slightly farther to the side.', medium: 'From this front view, your working knee may appear close to the standing side.' },
  'a-la-seconde-working-knee-bent': { high: 'Lengthen and straighten your working leg.', medium: 'Your working knee appears slightly bent; lengthen through the leg.' },
  'a-la-seconde-working-leg-not-side': { high: 'Move your working leg outward into the side plane without forcing it lower.', medium: 'Your working leg may be drifting away from the side plane; guide it slightly outward.' },
  'a-la-seconde-foot-not-pointed': { high: 'Lengthen through your ankle and point your working toes.', medium: 'Your working foot may be shortening the leg line; lengthen through the toes.' },
  'a-la-seconde-turnout-not-visible': { high: 'Rotate your working leg outward until the heel is slightly visible.', medium: 'The working heel line is unclear; show a little more heel if comfortable.' },
  'a-la-seconde-pelvis-out-of-line': { high: 'Bring your pelvis closer to level while keeping the working leg long.', medium: 'Your pelvic line may be lifting more than the leg height requires.' },
  'tendu-working-knee-bent': { high: 'Lengthen and straighten your working leg.', medium: 'Your working knee appears slightly bent; lengthen through the leg.' },
  'tendu-foot-not-pointed': { high: 'Lengthen through your ankle and point your working toes.', medium: 'Your working foot may be shortening the tendu line; lengthen through the toes.' },
  'tendu-working-foot-lifted': { high: 'Reach your working toes back to the floor.', medium: 'Your working toes may be lifting; reach them gently toward the floor.' },
  'tendu-crossing-too-small': { high: 'Reach your working foot slightly farther across while keeping both knees straight.', medium: 'The croise crossing may look narrow; reach the working foot a little farther across.' },
} satisfies Record<string, FeedbackCopyVariants>;

export function feedbackCopyFor(ruleId: string, confidence: 'high' | 'medium'): string {
  const copy = (FEEDBACK_COPY as Record<string, FeedbackCopyVariants>)[ruleId];
  if (copy === undefined) {
    throw new Error(`Missing approved feedback copy for rule: ${ruleId}`);
  }
  return copy[confidence];
}

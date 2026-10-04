import { z } from 'zod';

export const bodyRegionSchema = z.enum([
  'supporting-leg',
  'working-leg',
  'pelvis',
  'torso',
  'shoulders-arms',
  'head',
  'feet',
]);

export const correctionLabelSchema = z.object({
  region: bodyRegionSchema,
  direction: z.string().trim().min(1),
});

export type CorrectionLabel = z.infer<typeof correctionLabelSchema>;

export const labelledCaseSchema = z.object({
  id: z.string().min(1),
  position: z.enum([
    'arabesque',
    'attitude-derriere',
    'retire-passe',
    'a-la-seconde',
    'tendu-croise-devant',
  ]),
  supportingSide: z.enum(['left', 'right']),
  assessable: z.boolean(),
  expectedTop3: z.array(correctionLabelSchema).max(3),
  actualTop3: z.array(correctionLabelSchema).max(3),
});

export type LabelledCase = z.infer<typeof labelledCaseSchema>;

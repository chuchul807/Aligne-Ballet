import type { PoseName } from './types';

const POSE_LABELS: Readonly<Record<PoseName, string>> = {
  arabesque: 'Arabesque',
  'attitude-derriere': 'Attitude derrière',
  'retire-passe': 'Retiré / Passé',
  'a-la-seconde': 'À la seconde (en face)',
  'tendu-croise-devant': 'Tendu croisé devant (en face)',
};

export function poseLabel(position: PoseName): string {
  return POSE_LABELS[position];
}

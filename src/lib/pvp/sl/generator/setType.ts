/* What the generator's picker offers: a Teams mode with every board on its
 * default map, or Supreme League on the data file's maps. */

import { TEAM_VARIANTS, type TeamModeKey } from '@/lib/teams/modes'

export const SL_SET_TYPES = ['3v3', '5v5', 'sl'] as const

export type SlSetType = (typeof SL_SET_TYPES)[number]

export const slSetMode = (type: SlSetType): TeamModeKey =>
  type === 'sl' ? TEAM_VARIANTS.sl.mode : type

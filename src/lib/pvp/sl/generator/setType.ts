/* What the generator's picker offers: a Teams mode with every board on its
 * default map, or Supreme League on its current maps. The data file can be a
 * rotation behind those maps, so slBoards pairs each board with the file's
 * teams. */

import { DEFAULT_VARIANT, TEAM_VARIANTS, variantMaps, type TeamModeKey } from '@/lib/teams/modes'
import type { SlData } from '../data/types'

export const SL_SET_TYPES = ['3v3', '5v5', 'sl'] as const

export type SlSetType = (typeof SL_SET_TYPES)[number]

export const slSetMode = (type: SlSetType): TeamModeKey =>
  type === 'sl' ? TEAM_VARIANTS.sl.mode : type

export interface SlBoard {
  key: string
  // The map's place in the type's list, which boards on one map share.
  map: number
  // The file's map whose teams the board takes, or -1 when it has none to give.
  source: number
  // Whether those teams were recorded on this board's own map.
  recorded: boolean
}

// A map the file does not hold takes the teams of a map that has left the list,
// the first map missing from the file with the first map gone from the list.
export function slBoards(data: SlData, type: SlSetType): SlBoard[] {
  const keys = type === 'sl' ? TEAM_VARIANTS.sl.maps : variantMaps(type, DEFAULT_VARIANT)
  const held = data.maps
  const replaced = held.flatMap((key, i) => (keys.includes(key) ? [] : [i]))
  return keys.map((key) => {
    const own = held.indexOf(key)
    return {
      key,
      map: keys.indexOf(key),
      source: own < 0 ? (replaced.shift() ?? -1) : own,
      recorded: own >= 0,
    }
  })
}

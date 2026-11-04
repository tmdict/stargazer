/* What the generator's picker offers: a Teams mode with every board on its
 * default map, or Supreme League on its current maps, and the teams each board
 * draws from. */

import { presetLayout, type MapLayout } from '@/lib/maps'
import { DEFAULT_VARIANT, TEAM_VARIANTS, variantMaps, type TeamModeKey } from '@/lib/teams/modes'
import type { SlData } from '../data/types'

export const SL_SET_TYPES = ['3v3', '5v5', 'sl'] as const

export type SlSetType = (typeof SL_SET_TYPES)[number]

export const slSetMode = (type: SlSetType): TeamModeKey =>
  type === 'sl' ? TEAM_VARIANTS.sl.mode : type

export interface SlBoard {
  layout: MapLayout
  // The map's place in the set's list, which boards on one map share.
  map: number
  // The board's own map in the file, whose teams it takes; null on a map with
  // no records, which takes the teams of every map.
  source: number | null
}

export function layoutBoards(data: SlData, layouts: readonly MapLayout[]): SlBoard[] {
  const keys = layouts.map((layout) => layout.key)
  return layouts.map((layout) => {
    const own = data.maps.indexOf(layout.key)
    return { layout, map: keys.indexOf(layout.key), source: own < 0 ? null : own }
  })
}

export const slBoards = (data: SlData, type: SlSetType): SlBoard[] =>
  layoutBoards(
    data,
    (type === 'sl' ? TEAM_VARIANTS.sl.maps : variantMaps(type, DEFAULT_VARIANT)).map((key) =>
      presetLayout(key)!,
    ),
  )

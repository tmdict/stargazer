/* The boards a set is chosen for, and the teams each board draws from. */

import { presetLayout, type MapLayout } from '@/lib/maps'
import type { SlData } from '../data/types'

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
  const recorded = data.maps.map((m) => m.key)
  return layouts.map((layout) => {
    const own = recorded.indexOf(layout.key)
    return { layout, map: keys.indexOf(layout.key), source: own < 0 ? null : own }
  })
}

// Boards on preset maps, by their keys.
export const slBoards = (data: SlData, maps: readonly string[]): SlBoard[] =>
  layoutBoards(
    data,
    maps.map((key) => presetLayout(key)!),
  )

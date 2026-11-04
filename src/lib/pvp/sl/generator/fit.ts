/* How much of a team's own effects its board's map leaves it. A board whose
 * map has no recorded games takes the teams of the map it replaced
 * (slBoards). A team there keeps the points its goals earn in the engine's
 * best placement on the new map, as a share of those on the map it was
 * recorded on, at most all of them. A team recorded on its board's map, or one
 * whose goals earn nothing on the old map, keeps all of them. Both placements
 * leave out the artifact and the enemy units' rules, so the share is the
 * team's alone. */

import { effectPoints } from '@/lib/placement/engine'
import { PLACEMENT_LOOKUPS } from '@/lib/placement/lookups'
import type { SlData } from '../data/types'
import { summonedPhantimal } from './formation'
import type { SlBoard } from './setType'

export interface SlFit {
  // The share, or undefined while it waits on a placement.
  known(board: SlBoard, heroes: number[]): number | undefined
  measure(board: SlBoard, heroes: number[]): number
}

// Each lineup is placed once for the life of the result, so the worker keeps
// one for the visit.
export function slFit(data: SlData): SlFit {
  const placement = { ...data.placement, pickRates: {} }
  const measured = new Map<string, number>()
  const keyOf = (board: SlBoard, heroes: number[]): string =>
    `${board.source}|${board.key}|${heroes.join(',')}`
  const known = (board: SlBoard, heroes: number[]): number | undefined =>
    board.recorded ? 1 : measured.get(keyOf(board, heroes))
  return {
    known,
    measure(board, heroes) {
      const share = known(board, heroes)
      if (share !== undefined) return share
      const team = { heroes, phantimal: summonedPhantimal(data, heroes) }
      const points = (mapKey: string): number =>
        effectPoints(team, mapKey, placement, PLACEMENT_LOOKUPS)
      const before = points(data.maps[board.source]!)
      const kept = before > 0 ? Math.min(1, Math.max(0, points(board.key) / before)) : 1
      measured.set(keyOf(board, heroes), kept)
      return kept
    },
  }
}

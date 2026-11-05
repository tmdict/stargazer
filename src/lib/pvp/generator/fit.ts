/* How much of a team's own effects its board's map leaves it. A board takes
 * only teams that have an ally tile on its map for each of their units
 * (`stands`), since a row of every map (chooser.ts) may have been recorded on
 * a map with more tiles. A team on another map than the one it was recorded
 * on keeps the points its goals earn in the engine's best placement on the
 * board's map, as a share of those on its own map (for a row of every map,
 * its home), at most all of them. A team on its own map, or one whose goals
 * earn nothing there, keeps all of them. Both placements leave out the
 * artifact and the enemy units' rules, so the share is the team's alone. */

import { companionIdsOf } from '@/lib/characters/companion'
import { configTiles, presetLayout, type MapLayout } from '@/lib/maps'
import { effectPoints } from '@/lib/placement/engine'
import { PLACEMENT_LOOKUPS } from '@/lib/placement/lookups'
import type { PlacementTeam } from '@/lib/placement/types'
import { Team } from '@/lib/types/team'
import type { SlData } from '../data/types'
import { summonedPhantimal } from './formation'
import type { SlBoard } from './setType'

export interface SlFit {
  // Whether the heroes' team has an ally tile for each of its units, its
  // companions included, on the board's map.
  stands(board: SlBoard, heroes: number[]): boolean
  // The share, or undefined while it waits on a placement, for heroes
  // recorded on the file's map `from` (an index into its maps).
  known(board: SlBoard, heroes: number[], from: number): number | undefined
  measure(board: SlBoard, heroes: number[], from: number): number
}

const tilesTaken = ({ heroes, phantimal }: PlacementTeam): number =>
  [...heroes, ...(phantimal === undefined ? [] : [phantimal])].reduce(
    (n, unit) => n + 1 + companionIdsOf(unit).length,
    0,
  )

// Each lineup is placed once on each map for the life of the result, so the
// worker keeps one for the visit. A team is placed on its own map once,
// however many boards it is measured on.
export function slFit(data: SlData): SlFit {
  const placement = { ...data.placement, pickRates: {} }
  const measured = new Map<string, number>()
  const atHome = new Map<string, number>()
  const room = new Map<string, boolean>()
  const teamOf = (heroes: number[]): PlacementTeam => ({
    heroes,
    phantimal: summonedPhantimal(data, heroes),
  })
  const keyOf = (board: SlBoard, heroes: number[], from: number): string =>
    `${from}|${board.layout.key}|${heroes.join(',')}`
  const known = (board: SlBoard, heroes: number[], from: number): number | undefined =>
    from === board.source ? 1 : measured.get(keyOf(board, heroes, from))
  return {
    stands(board, heroes) {
      const key = `${board.layout.key}|${heroes.join(',')}`
      if (!room.has(key)) {
        const tiles = configTiles(board.layout.config, Team.ALLY).size
        room.set(key, tilesTaken(teamOf(heroes)) <= tiles)
      }
      return room.get(key)!
    },
    known,
    measure(board, heroes, from) {
      const share = known(board, heroes, from)
      if (share !== undefined) return share
      const team = teamOf(heroes)
      const points = (layout: MapLayout): number =>
        effectPoints(team, layout, placement, PLACEMENT_LOOKUPS)
      const home = `${from}|${heroes.join(',')}`
      let before = atHome.get(home)
      if (before === undefined) {
        before = points(presetLayout(data.maps[from]!.key)!)
        atHome.set(home, before)
      }
      const kept = before > 0 ? Math.min(1, Math.max(0, points(board.layout) / before)) : 1
      measured.set(keyOf(board, heroes, from), kept)
      return kept
    },
  }
}

/* How much of a team's own effects its board's map leaves it. A board takes
 * only teams that have an ally tile on its map for each of their units
 * (`stands`), since a row of every map (chooser.ts) may have been recorded on
 * a map with more tiles. A team on another map than the one it was recorded
 * on keeps the points its goals earn in the engine's best placement on the
 * board's map, as a share of those on its own map (for a row of every map,
 * its home), at most all of them. A team on its own map, or one whose goals
 * earn nothing there, keeps all of them. Both placements leave out the
 * artifact and the enemy units' rules, so the share is the team's alone.
 * The search on the board's map stops once its best placement keeps all of
 * them, since the share is capped there. A later start could still find a
 * placement the engine rates higher that keeps fewer, so a stopped search can
 * only rate a team higher than the full one would; it never did in any case
 * measured.
 *
 * The points are kept per map and lineup, the home map's among them. A lineup
 * has one home in the file, so the points a board's search stopped at are only
 * ever read against that home's. */

import { companionIdsOf } from '@/lib/characters/companion'
import { configTiles, presetLayout, type MapLayout } from '@/lib/maps'
import { effectPoints } from '@/lib/placement/engine'
import { PLACEMENT_LOOKUPS } from '@/lib/placement/lookups'
import type { PlacementTeam } from '@/lib/placement/types'
import { Team } from '@/lib/types/team'
import type { SlData } from '../data/types'
import { summonedPhantimal } from './formation'
import type { SlBoard } from './setType'
import type { StoredPoints } from './storedFits'

export interface SlFitRequest {
  board: SlBoard
  heroes: number[]
  // The file's map the heroes were recorded on (an index into its maps).
  from: number
}

// A fit check: the lineup placed on its home map, unless `home` already holds
// its points there, then on the board's map.
export interface FitJob {
  heroes: number[]
  from: number
  home?: number
  board: MapLayout
}

// What a fit check finds; nothing on the board's map when the home map gives
// no points, since the team then keeps all of them.
export interface FitPoints {
  home: number
  board: number | null
}

export interface SlFit {
  // Whether the heroes' team has an ally tile for each of its units, its
  // companions included, on the board's map.
  stands(board: SlBoard, heroes: number[]): boolean
  // The share, or undefined while it waits on a placement.
  known(board: SlBoard, heroes: number[], from: number): number | undefined
  measure(board: SlBoard, heroes: number[], from: number): number
}

// The store the worker keeps for the visit, which fit checks run elsewhere
// can fill: `jobs` gives the checks a set of requests still needs, and
// `record` keeps what each found, returning the points it did not hold yet.
// `seed` adds points kept from an earlier visit.
export interface SlFitStore extends SlFit {
  jobs(requests: readonly SlFitRequest[]): FitJob[]
  record(job: FitJob, points: FitPoints): StoredPoints
  seed(points: StoredPoints): void
}

const teamOf = (data: SlData, heroes: number[]): PlacementTeam => ({
  heroes,
  phantimal: summonedPhantimal(data, heroes),
})

const tilesTaken = ({ heroes, phantimal }: PlacementTeam): number =>
  [...heroes, ...(phantimal === undefined ? [] : [phantimal])].reduce(
    (n, unit) => n + 1 + companionIdsOf(unit).length,
    0,
  )

export function fitPoints(data: SlData, { heroes, from, home, board }: FitJob): FitPoints {
  const team = teamOf(data, heroes)
  const placement = { ...data.placement, pickRates: {} }
  const points = (layout: MapLayout, enough?: number): number =>
    effectPoints(team, layout, placement, PLACEMENT_LOOKUPS, enough)
  const before = home ?? points(presetLayout(data.maps[from]!.key)!)
  return { home: before, board: before > 0 ? points(board, before) : null }
}

// Each lineup is placed once on each map for the life of the store, so the
// worker keeps one for the visit. A team is placed on its own map once,
// however many boards it is measured on.
export function slFit(data: SlData): SlFitStore {
  const points = new Map<string, Map<string, number>>()
  const room = new Map<string, boolean>()
  const homeOf = (from: number): string => data.maps[from]!.key
  const lineupOf = (heroes: number[]): string => heroes.join(',')
  const pointsOn = (map: string, lineup: string): number | undefined => points.get(map)?.get(lineup)
  const keep = (map: string, lineup: string, value: number): void => {
    let lineups = points.get(map)
    if (!lineups) points.set(map, (lineups = new Map()))
    lineups.set(lineup, value)
  }
  const known = (board: SlBoard, heroes: number[], from: number): number | undefined => {
    if (from === board.source) return 1
    const lineup = lineupOf(heroes)
    const home = pointsOn(homeOf(from), lineup)
    if (home === undefined) return undefined
    if (home <= 0) return 1
    const kept = pointsOn(board.layout.key, lineup)
    return kept === undefined ? undefined : Math.min(1, Math.max(0, kept / home))
  }
  const jobs = (requests: readonly SlFitRequest[]): FitJob[] => {
    const found = new Map<string, FitJob>()
    for (const { board, heroes, from } of requests) {
      const key = `${board.layout.key}|${lineupOf(heroes)}`
      if (found.has(key) || known(board, heroes, from) !== undefined) continue
      const home = pointsOn(homeOf(from), lineupOf(heroes))
      found.set(key, { heroes, from, home, board: board.layout })
    }
    return [...found.values()]
  }
  const record = (job: FitJob, found: FitPoints): StoredPoints => {
    const lineup = lineupOf(job.heroes)
    const added: StoredPoints = {}
    const add = (map: string, value: number): void => {
      if (pointsOn(map, lineup) !== undefined) return
      keep(map, lineup, value)
      ;(added[map] ??= {})[lineup] = value
    }
    add(homeOf(job.from), found.home)
    if (found.board !== null) add(job.board.key, found.board)
    return added
  }
  return {
    stands(board, heroes) {
      const key = `${board.layout.key}|${lineupOf(heroes)}`
      if (!room.has(key)) {
        const tiles = configTiles(board.layout.config, Team.ALLY).size
        room.set(key, tilesTaken(teamOf(data, heroes)) <= tiles)
      }
      return room.get(key)!
    },
    known,
    measure(board, heroes, from) {
      const share = known(board, heroes, from)
      if (share !== undefined) return share
      for (const job of jobs([{ board, heroes, from }])) record(job, fitPoints(data, job))
      return known(board, heroes, from)!
    },
    jobs,
    record,
    seed(stored) {
      for (const [map, lineups] of Object.entries(stored))
        for (const [lineup, value] of Object.entries(lineups)) keep(map, lineup, value)
    },
  }
}

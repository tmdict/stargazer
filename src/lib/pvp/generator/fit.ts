/* How much of a team's own effects its board's map leaves it. A board takes
 * only teams that have an ally tile on its map for each of their units
 * (`stands`), since a row of every map (chooser.ts) may have been recorded on
 * a map with more tiles. A team keeps the points its goals earn in the
 * engine's best placement on the board's map, as a share of those on its
 * lineup's main map (the home of its row of every map), at most all of them.
 * A team on its main map, or one whose goals earn nothing there, keeps all of
 * them. A team recorded on the board's map is measured too: a few games there
 * do not show its effects work there, since a map's tiles can keep two of
 * them from both being met. Both placements leave out the
 * artifact, the enemy units' rules and the buff tiles, so the share is the
 * team's alone and a map's points are the same whichever mode's board asked
 * for them.
 * A lineup with a hard rule (types/rule.ts) is also placed on its main map,
 * and on a board's map whatever its points: a board never takes a team whose
 * best placement on its map breaks one. Such a placement's points are kept for
 * the visit only, so what the browser holds is always a placement that keeps
 * them.
 * The search on the board's map stops once its best placement keeps all of
 * the main map's points, since the share is capped there. A later start could
 * still find a placement the engine rates higher that keeps fewer, so a
 * stopped search can only rate a team higher than the full one would; it
 * never did in any case measured.
 *
 * The points are kept per map and lineup, the home map's among them. A lineup
 * has one home in the file, so the points a board's search stopped at are only
 * ever read against that home's.
 *
 * The fit table (fitTable.ts) holds what these checks find for every lineup of
 * the file on every preset map, so a store given one places a lineup only on
 * a Map Editor map. */

import { companionIdsOf } from '@/lib/characters/companion'
import { toPhantimalId } from '@/lib/characters/phantimal'
import { lineupQualifies } from '@/lib/characters/phantimalFaction'
import { loadPhantimals } from '@/lib/dataLoader'
import { configTiles, presetLayout, type MapLayout } from '@/lib/maps'
import { effectPoints } from '@/lib/placement/engine'
import { isHardRule } from '@/lib/placement/goals'
import { PLACEMENT_LOOKUPS } from '@/lib/placement/lookups'
import type { PlacementTeam } from '@/lib/placement/types'
import { isRetiredSeason } from '@/lib/seasonal'
import { Team } from '@/lib/types/team'
import { lineupKey } from '../data/sides'
import type { SlData, SlFitTable } from '../data/types'
import type { SlBoard } from './setType'
import type { StoredPoints } from './storedFits'

export interface SlFitRequest {
  board: SlBoard
  heroes: number[]
}

// A fit check: the lineup placed on its main map, `from` (an index into the
// file's maps), unless `home` already holds its points there or it has none,
// then on the board's map, which a check of the main map alone leaves out.
export interface FitJob {
  heroes: number[]
  from?: number
  home?: number
  board?: MapLayout
  // The lineup placed without the phantimal it summons.
  plain?: true
}

// A lineup's best placement on one map: the points its goals earn, and
// whether it keeps every hard rule of the lineup.
export interface MapPoints {
  points: number
  keeps: boolean
}

// What a fit check finds on each map it placed the lineup on; nothing on the
// board's map when the home map gives no points and the lineup has no hard
// rule, since the team then keeps all of them.
export interface FitPoints {
  home?: MapPoints
  board?: MapPoints
}

export interface SlFit {
  // Whether the heroes' team has an ally tile for each of its units, its
  // companions included, on the board's map.
  stands(board: SlBoard, heroes: number[]): boolean
  // The share, null for a team the board does not take since no placement
  // found on its map keeps its hard rules, or undefined while it waits on a
  // placement.
  known(board: SlBoard, heroes: number[]): number | null | undefined
  measure(board: SlBoard, heroes: number[]): number | null
}

// The store the worker keeps for the visit, which fit checks run elsewhere
// can fill: `jobs` gives the checks a set of requests still needs, and
// `record` keeps what each found, returning the points it did not hold yet.
// `seed` adds points kept from an earlier visit. `refused` lists the lineups
// the visit asked about on a map that does not take them. `placed` is a
// lineup's placement on a map as the store holds it.
export interface SlFitStore extends SlFit {
  jobs(requests: readonly SlFitRequest[]): FitJob[]
  record(job: FitJob, points: FitPoints): StoredPoints
  seed(points: StoredPoints): void
  refused(map: string): number[][]
  placed(map: string, heroes: number[]): MapPoints | undefined
}

// Each of a season's phantimals needs three heroes of its own factions, so
// five heroes can summon one of them at most.
export function summonedPhantimal(data: SlData, heroes: number[]): number | undefined {
  if (isRetiredSeason(data.season)) return undefined
  const phantimal = loadPhantimals().find((p) =>
    lineupQualifies(p, heroes, PLACEMENT_LOOKUPS.factionOf),
  )
  return phantimal && toPhantimalId(phantimal.id)
}

export const teamOf = (data: SlData, heroes: number[], plain = false): PlacementTeam => ({
  heroes,
  phantimal: plain ? undefined : summonedPhantimal(data, heroes),
})

const tilesTaken = ({ heroes, phantimal }: PlacementTeam): number =>
  [...heroes, ...(phantimal === undefined ? [] : [phantimal])].reduce(
    (n, unit) => n + 1 + companionIdsOf(unit).length,
    0,
  )

const hasHardRule = ({ heroes, phantimal }: PlacementTeam): boolean =>
  [...heroes, ...(phantimal === undefined ? [] : [phantimal])].some((unit) =>
    PLACEMENT_LOOKUPS.rulesOf(unit).some(isHardRule),
  )

export function fitPoints(data: SlData, { heroes, from, home, board, plain }: FitJob): FitPoints {
  const team = teamOf(data, heroes, plain)
  const placement = { ...data.placement, pickRates: {} }
  const place = (layout: MapLayout, enough?: number): MapPoints =>
    effectPoints(team, { ...layout, buffTiles: [] }, placement, PLACEMENT_LOOKUPS, enough)
  const placed =
    from === undefined || home !== undefined
      ? undefined
      : place(presetLayout(data.maps[from]!.key)!)
  if (!board) return { home: placed }
  const before = home ?? placed?.points
  if (before === undefined) return { board: place(board) }
  if (before > 0) return { home: placed, board: place(board, before) }
  return { home: placed, board: hasHardRule(team) ? place(board) : undefined }
}

const lineupOf = (heroes: number[]): string => heroes.join(',')

// A table's set by map and lineup, read in place.
function tableReader(
  data: SlData,
  { maps, seasonal, plain }: SlFitTable,
  withoutPhantimal: boolean,
): (map: string, lineup: string) => MapPoints | undefined {
  const { points, refused } = withoutPhantimal ? plain : seasonal
  const rows = new Map(data.everyMap.map(({ heroes }, row) => [lineupOf(heroes), row]))
  const columns = new Map(maps.map((key, column) => [key, column]))
  const broken = new Set(refused.map(([row, column]) => row * maps.length + column))
  return (map, lineup) => {
    const row = rows.get(lineup)
    const column = columns.get(map)
    if (row === undefined || column === undefined) return undefined
    const earned = points[row]![column]
    return earned == null
      ? undefined
      : { points: earned, keeps: !broken.has(row * maps.length + column) }
  }
}

// Each lineup is placed once on each map for the life of the store, so the
// worker keeps one for the visit. A team is placed on its own map once,
// however many boards it is measured on. A `plain` store places every lineup
// without its phantimal, for the boards of a format that fields none: a
// phantimal can keep a hard rule, such as a seat in Himmel's party. With a
// fit table, the store answers from its set where the table has the placement.
export function slFit(data: SlData, plain = false, table: SlFitTable | null = null): SlFitStore {
  const job = (found: FitJob): FitJob => (plain ? { ...found, plain: true } : found)
  const ahead = table && tableReader(data, table, plain)
  const placements = new Map<string, Map<string, MapPoints>>()
  // The lineups a map was asked about and does not take.
  const left = new Map<string, Map<string, number[]>>()
  const hard = new Map<string, boolean>()
  const room = new Map<string, boolean>()
  const homeOf = (from: number): string => data.maps[from]!.key
  const mainOf = new Map(data.everyMap.map((row) => [lineupKey(row.heroes), row.home]))
  const keep = (map: string, lineup: string, at: MapPoints): void => {
    let lineups = placements.get(map)
    if (!lineups) placements.set(map, (lineups = new Map()))
    lineups.set(lineup, at)
  }
  const held = (map: string, lineup: string): MapPoints | undefined => {
    const own = placements.get(map)?.get(lineup)
    if (own || !ahead) return own
    const made = ahead(map, lineup)
    if (made) keep(map, lineup, made)
    return made
  }
  const hasHard = (heroes: number[]): boolean => {
    const lineup = lineupOf(heroes)
    if (!hard.has(lineup)) hard.set(lineup, hasHardRule(teamOf(data, heroes, plain)))
    return hard.get(lineup)!
  }
  // A lineup with a hard rule waits on its placement on the board's map even
  // where it keeps all its points, on its main map or with none to keep.
  const known = (board: SlBoard, heroes: number[]): number | null | undefined => {
    const lineup = lineupOf(heroes)
    const map = board.layout.key
    const here = held(map, lineup)
    if (here && !here.keeps) {
      let lineups = left.get(map)
      if (!lineups) left.set(map, (lineups = new Map()))
      lineups.set(lineup, heroes)
      return null
    }
    const placed = !hasHard(heroes) || here !== undefined
    const from = mainOf.get(lineupKey(heroes))
    if (from === undefined || from === board.source) return placed ? 1 : undefined
    const home = held(homeOf(from), lineup)
    if (home === undefined) return undefined
    if (home.points <= 0) return placed ? 1 : undefined
    return here === undefined ? undefined : Math.min(1, Math.max(0, here.points / home.points))
  }
  const jobs = (requests: readonly SlFitRequest[]): FitJob[] => {
    const found = new Map<string, FitJob>()
    for (const { board, heroes } of requests) {
      const lineup = lineupOf(heroes)
      const key = `${board.layout.key}|${lineup}`
      if (found.has(key) || known(board, heroes) !== undefined) continue
      const from = mainOf.get(lineupKey(heroes))
      if (from === undefined) found.set(key, job({ heroes, board: board.layout }))
      else if (from === board.source) found.set(key, job({ heroes, from }))
      else {
        const home = held(homeOf(from), lineup)?.points
        found.set(key, job({ heroes, from, home, board: board.layout }))
      }
    }
    return [...found.values()]
  }
  const record = (job: FitJob, found: FitPoints): StoredPoints => {
    const lineup = lineupOf(job.heroes)
    const added: StoredPoints = {}
    const add = (map: string, at: MapPoints | undefined): void => {
      if (!at || held(map, lineup)) return
      keep(map, lineup, at)
      if (at.keeps) (added[map] ??= {})[lineup] = at.points
    }
    if (job.from !== undefined) add(homeOf(job.from), found.home)
    if (job.board) add(job.board.key, found.board)
    return added
  }
  return {
    stands(board, heroes) {
      const key = `${board.layout.key}|${lineupOf(heroes)}`
      if (!room.has(key)) {
        const tiles = configTiles(board.layout.config, Team.ALLY).size
        room.set(key, tilesTaken(teamOf(data, heroes, plain)) <= tiles)
      }
      return room.get(key)!
    },
    known,
    measure(board, heroes) {
      const share = known(board, heroes)
      if (share !== undefined) return share
      for (const job of jobs([{ board, heroes }])) record(job, fitPoints(data, job))
      return known(board, heroes)!
    },
    jobs,
    record,
    refused: (map) => [...(left.get(map)?.values() ?? [])],
    placed: (map, heroes) => held(map, lineupOf(heroes)),
    seed(stored) {
      for (const [map, lineups] of Object.entries(stored))
        for (const [lineup, points] of Object.entries(lineups))
          keep(map, lineup, { points, keeps: true })
    },
  }
}

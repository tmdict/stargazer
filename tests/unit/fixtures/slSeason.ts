/**
 * Made-up PvP files for the generator's tests: five maps, two groups, and one
 * evidence rule every team with a decided game passes.
 */

import { lineupKey } from '@/lib/pvp/data/sides'
import type { SlData, SlEveryMapTeam, SlModel, SlTeam } from '@/lib/pvp/data/types'
import { slFit, type SlFit } from '@/lib/pvp/generator/fit'
import type { SlChoiceTeam } from '@/lib/pvp/generator/types'

// A lineup on map `map`, its games counted whole by a single player.
export type MadeUpTeam = Pick<SlTeam, 'family' | 'heroes' | 'artifacts' | 'decided'> & {
  map: number
}

export const seededRandom = (seed: number) => () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
  return seed / 2 ** 32
}

// A chosen team's record in the file: on one map, or over every map.
export const fileTeam = (
  data: SlData,
  { source, team }: Pick<SlChoiceTeam, 'source' | 'team'>,
): SlTeam => (source === null ? data.everyMap[team]! : data.maps[source]!.teams[team]!)

// A fit that leaves every team all of its effects, for a test of rules a fit
// cannot change: a fit decides which allowed set wins, never whether one
// exists, and the engine's placements behind real fits take seconds.
export const wholeFit = (data: SlData): SlFit => ({
  stands: slFit(data).stands,
  known: () => 1,
  measure: () => 1,
})

// Every number the tests leave out counts 0.
export const madeUpModel = (numbers: Partial<SlModel>): SlModel => ({
  gap: 0,
  emptySlot: 0,
  typicalHeroes: 0,
  typicalArtifact: 0,
  fieldAgainst: {},
  heroes: {},
  lineups: {},
  counters: {},
  artifacts: {},
  artifactsOnKind: {},
  ...numbers,
})

// Each team ranks by its place in `teams`, and a lineup's row over every map
// adds up its teams, at home on the map with the most decided games.
export function madeUpData(teams: MadeUpTeam[], model: SlModel, fallback: number[][]): SlData {
  const record = (t: MadeUpTeam, rank: number): SlTeam => ({
    heroes: t.heroes,
    family: t.family,
    rank,
    decided: t.decided,
    games: t.decided,
    players: 1,
    artifacts: t.artifacts,
  })
  const lineups = new Map<string, number[]>()
  teams.forEach((t, i) =>
    lineups.set(lineupKey(t.heroes), [...(lineups.get(lineupKey(t.heroes)) ?? []), i]),
  )
  const everyMap = [...lineups.values()].map((list): SlEveryMapTeam => {
    const home = list.reduce((a, b) => (teams[b]!.decided > teams[a]!.decided ? b : a))
    const decided = list.reduce((n, i) => n + teams[i]!.decided, 0)
    return {
      ...record(teams[list[0]!]!, list[0]!),
      decided,
      games: decided,
      players: list.length,
      home: teams[home]!.map,
    }
  })
  return {
    season: 8,
    exportedAt: '2026-10-01',
    seasons: [{ season: 8, weight: 1, sample: { matches: 1, games: 1, players: 1 } }],
    evidence: [{ groupGames: 0, players: 0, games: 1, oneOffs: true }],
    flex: { heroes: 2, options: 2 },
    prices: { paragon: { f: [0, 10, 20, 30, 40] }, refinement: [0, 5, 10, 15, 20] },
    order: [...new Set(teams.flatMap((t) => t.heroes))].sort((a, b) => a - b),
    placement: { lists: {}, leans: { front: [], back: [] }, weights: {} },
    model,
    fallback,
    families: [0, 1].map(() => ({ name: {}, core: [], swaps: [] })),
    maps: Array.from({ length: 5 }, (_, map) => ({
      key: `map-${map}`,
      pickRates: {},
      records: [
        [1, 1, 0],
        [1, 1, 0],
      ],
      teams: teams.flatMap((t, i) =>
        t.map === map ? [{ ...record(t, i), placements: [{ c: [], s: [] }] }] : [],
      ),
    })),
    everyMap,
  }
}

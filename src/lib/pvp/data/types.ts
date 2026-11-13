/* The PvP data file, as codec.ts reads it. The external report generator owns
 * the format and publishes what each field means; these types are the fields
 * Stargazer reads. Every season's games count at their season's weight, and
 * every artifact and phantimal id is the live season's. */

import type { PlacementData } from '@/lib/placement/types'

// [tile, unit id], tiles numbered from the ally side.
export type SlUnit = [tile: number, id: number]

export interface SlPlacement {
  // Heroes and their companions (N * 10000 + the hero's id).
  c: SlUnit[]
  // The phantimal, then its companions (N * 10000 + the phantimal's id); empty
  // on a board of an earlier season, whose phantimal the generator places.
  s: SlUnit[]
  // The share of the engine's formation's score the board's own record in the
  // live season adds when the two are compared; left out when it adds none.
  b?: number
  // 1 when every one of the board's live-season games was played without
  // Spirit Marks.
  a?: 1
}

// A lineup's record on one map, or on every map together.
export interface SlTeam {
  heroes: number[]
  // Index into families; null outside every group.
  family: number | null
  // Tie order among every lineup in the file.
  rank: number
  // Its games with a winner, whole games from every season, and those it won.
  decided: number
  wins: number
  // The same games and the players who fielded it, each at its season's
  // weight, for the evidence rule.
  games: number
  players: number
  // [artifact id, games played with it] on the live season's boards, most
  // used first; empty for a team only earlier seasons recorded.
  artifacts: [id: number, games: number][]
}

export interface SlMapTeam extends SlTeam {
  // The boards it can draw, the one it draws most often first. Empty when its
  // games recorded no formation, and then pick is absent.
  placements: SlPlacement[]
  // [artifact, index into placements] for each artifact (null for none) that
  // draws a board other than the first.
  pick?: [artifact: number | null, placement: number][]
  // Outside every group alone: its own record on the map, kept as a group's.
  record?: SlRecord
}

export interface SlEveryMapTeam extends SlTeam {
  // Index into maps: where it has the most weighted decided games.
  home: number
}

// [players, wins, losses], whole games.
export type SlRecord = [players: number, wins: number, losses: number]

export interface SlMap {
  key: string
  // The placement engine's pick rates on this map.
  pickRates: Record<string, number>
  // Each group's record on the map, in group order.
  records: SlRecord[]
  teams: SlMapTeam[]
}

export interface SlFamily {
  // By language code; a site language missing here names the group by its core.
  name: Partial<Record<string, string>>
  core: number[]
  // The group's recorded teams, for the swaps.
  swaps: number[][]
}

// What a season's numbers come from: its recorded matches and games in every
// format, and the players in them.
export interface SlSample {
  matches: number
  games: number
  players: number
}

export interface SlSeason {
  season: number
  weight: number
  sample: SlSample
}

export interface SlEvidence {
  groupGames: number
  players: number
  games: number
  oneOffs: boolean
  // The fewest of its games on the map a team must have won.
  wins: number
}

export interface SlPrices {
  paragon: Record<string, number[]>
  refinement: number[]
}

export type SlRow = [number: number, wins: number, losses: number]
type SlHeroRow = [number: number, wins: number, losses: number, againstField: number]

// The prediction model's numbers.
export interface SlModel {
  gap: number
  emptySlot: number
  typicalHeroes: number
  typicalArtifact: number
  fieldAgainst: Record<string, number>
  heroes: Record<string, SlHeroRow>
  // By the five hero ids in ascending order, joined with /.
  lineups: Record<string, SlRow>
  // By hero:group.
  counters: Record<string, SlRow>
  artifacts: Record<string, SlRow>
  // By artifact:group.
  artifactsOnKind: Record<string, SlRow>
}

export interface SlData {
  // The live season.
  season: number
  // YYYY-MM-DD
  exportedAt: string
  // Every season the file draws on, the live one first.
  seasons: SlSeason[]
  // The rules a set's teams meet, each tried while no set meets the one
  // before: the strict rule, the relaxed one, then the last resort, which
  // alone takes a team that never won on its map.
  evidence: SlEvidence[]
  flex: { heroes: number; options: number }
  // Rivalry points by level (the index); the top level is the last.
  prices: SlPrices
  // Every hero id in the order of their English names, for ties.
  order: number[]
  // What the placement engine is tuned with, but for the pick rates, which
  // each map's entry holds.
  placement: Omit<PlacementData, 'pickRates'>
  model: SlModel
  // Per group, then one for teams outside every group: the artifacts a team
  // turns to when its own are taken, first choice first.
  fallback: number[][]
  families: SlFamily[]
  // Every map with records, in key order.
  maps: SlMap[]
  // Each lineup over every map together, in rank order.
  everyMap: SlEveryMapTeam[]
}

// One set of the fit table: the points each lineup's own goals earn in the
// placement engine's best placement on each map, and the placements among
// them that break a hard rule.
export interface SlFitSet {
  // A row per lineup, in the order of the data file's `everyMap`, and in each
  // a number per map of the table; null where the lineup is never placed.
  points: (number | null)[][]
  // [row, map], both indexes into `points`.
  refused: [row: number, map: number][]
}

// The fit table (pvp/fits.bin in the data pack), as codec.ts reads it: what
// the generator's fit checks find on the preset maps, worked out by npm run
// fits (docs/architecture/PLACEMENT.md).
export interface SlFitTable {
  // What the table was made from: the data file and the code and game data
  // the fit check loads.
  stamp: string
  // The preset maps by key, one per column of a set's rows.
  maps: string[]
  // Lineups placed with the phantimal they summon, and without it for the
  // boards of a format that fields none.
  seasonal: SlFitSet
  plain: SlFitSet
}

/* The Supreme League data file, as codec.ts reads it. The external report
 * generator owns the format and publishes what each field means; these types
 * are the fields Stargazer reads. */

import type { PlacementData } from '@/lib/placement/types'

// [tile, unit id], tiles numbered from the ally side.
export type SlUnit = [tile: number, id: number]

export interface SlPlacement {
  // Heroes and their companions (N * 10000 + the hero's id).
  c: SlUnit[]
  // The phantimal, then its companions (N * 10000 + the phantimal's id).
  s: SlUnit[]
}

interface SlTeamBase {
  // Index into SlData.maps.
  map: number
  // Index into its season's families; null outside every group.
  family: number | null
  heroes: number[]
  // Tie order among both seasons' teams.
  rank: number
  players: number
  // Its games with a winner.
  decided: number
  // The boards it can draw, the one it draws most often first.
  placements: SlPlacement[]
  // [artifact, index into placements] for each artifact (null for none) that
  // draws a board other than the first.
  pick?: [artifact: number | null, placement: number][]
}

export interface SlTeam extends SlTeamBase {
  // [artifact id, games played with it], most used first.
  artifacts: [id: number, games: number][]
}

// A team of the season before takes this season's artifacts, the first of
// these the set leaves free.
export interface SlBeforeTeam extends SlTeamBase {
  like: number[]
}

export interface SlFamily {
  // By language code; a site language missing here names the group by its core.
  name: Partial<Record<string, string>>
  core: number[]
  // The group's recorded teams, for the swaps.
  swaps: number[][]
  // [players, wins, losses] on each map.
  perMap: [players: number, wins: number, losses: number][]
}

// What a season's numbers come from: its recorded matches and games in every
// format, and the players in them.
export interface SlSample {
  matches: number
  games: number
  players: number
}

export interface SlSeason<Team> {
  sample: SlSample
  teams: Team[]
  families: SlFamily[]
}

export interface SlEvidence {
  groupGames: number
  players: number
  games: number
  oneOffs: boolean
}

export interface SlPrices {
  paragon: Record<string, number[]>
  refinement: number[]
}

export type SlRow = [number: number, wins: number, losses: number]
export type SlHeroRow = [number: number, wins: number, losses: number, againstField: number]

// The prediction model's numbers, each keyed as the reader looks it up.
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

export type SlBefore = SlSeason<SlBeforeTeam> & { season: number }

export interface SlData extends SlSeason<SlTeam> {
  season: number
  // YYYY-MM-DD
  exportedAt: string
  maps: string[]
  // The strict rule first, then the relaxed one.
  evidence: SlEvidence[]
  flex: { heroes: number; options: number }
  // Rivalry points by level (the index); the top level is the last.
  prices: SlPrices
  // Every hero id in the order of their English names, for ties.
  order: number[]
  // What the placement engine is tuned with, for the engine's formations.
  placement: PlacementData
  model: SlModel
  // Per group, then one for teams outside every group: the artifacts a team
  // turns to when its own are taken, first choice first.
  fallback: number[][]
  before?: SlBefore
  beforeUnder?: number
}

/* The Supreme League data file, as codec.ts reads it. The format and a
 * complete example are in docs/architecture/GUIDE.md ("The data file"). */

export type SlResult = 'w' | 'l' | 't'

// [team, result, gap, artifact]: the team's index, a win, a loss or a tie, the
// upgrade gap toward the team in Rivalry points, and the artifact on its board
// (null for none). Entries 2k and 2k + 1 are the two sides of one game.
export type SlGame = [team: number, result: SlResult, gap: number, artifact: number | null]

// Last season's games carry no artifact: its seasonal ids name other
// artifacts this season.
export type SlBeforeGame = [team: number, result: SlResult, gap: number]

// [tile, unit id], tiles numbered from the ally side.
export type SlUnit = [tile: number, id: number]

export interface SlPlacement {
  // The decided games played with it.
  games: number[]
  use: number
  players: number
  setups: number
  agree: number
  order: number
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
  games: number[]
  placements: SlPlacement[]
}

export interface SlTeam extends SlTeamBase {
  // Artifact ids, most used first.
  artifacts: number[]
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

export interface SlSeason<Team, Game> {
  sample: SlSample
  games: Game[]
  teams: Team[]
  families: SlFamily[]
}

export interface SlEvidence {
  groupGames: number
  players: number
  games: number
  oneOffs: boolean
}

export interface SlMap {
  key: string
  grid: { ally: number[]; enemy: number[]; blocked: number[]; breakable: number[] }
}

export interface SlPrices {
  paragon: Record<string, number[]>
  refinement: number[]
}

export type SlBefore = SlSeason<SlBeforeTeam, SlBeforeGame> & { season: number }

export interface SlData extends SlSeason<SlTeam, SlGame> {
  season: number
  // YYYY-MM-DD
  exportedAt: string
  maps: SlMap[]
  prior: number
  alpha: number
  // The strict rule first, then the relaxed one.
  evidence: SlEvidence[]
  flex: { heroes: number; options: number }
  // Rivalry points by level (the index); the top level is the last.
  prices: SlPrices
  // Every hero id in the order of their English names, for ties.
  order: number[]
  before?: SlBefore
  beforeUnder?: number
}

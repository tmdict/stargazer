/* The Supreme League generator's data file, as codec.ts reads it, and the
 * chooser's input and answer. The format and a complete example are in
 * docs/architecture/GUIDE.md ("Supreme League generator"). */

// [team, result, gap, opponent]: the team's index, a win, a loss or a tie, the
// upgrade gap toward the team in Rivalry points, and the opponent's log rating.
export type SlGame = [team: number, result: 'w' | 'l' | 't', gap: number, opponent: number]

// [tile, unit id], tiles numbered from the ally side.
export type SlUnit = [tile: number, id: number]

export interface SlPlacement {
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
  lineup: number[]
  placements: SlPlacement[]
}

export interface SlTeam extends SlTeamBase {
  // [artifact id, share of its boards], most used first.
  artifacts: [id: number, share: number][]
}

// A team of the season before takes this season's artifacts: the first of
// these no team before it in the set holds.
export interface SlBeforeTeam extends SlTeamBase {
  like: number[]
}

export interface SlFamily {
  // By language code; a site language missing here names the group by its core.
  name: Partial<Record<string, string>>
  expected: number
  spread: number
  core: number[]
  swaps: [heroes: number[], chance: number][]
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
  // Optional: the note on the data gives the counts when the file has them.
  sample?: SlSample
  theta: number
  oneOffStart: number
  games: SlGame[]
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

export interface SlData extends SlSeason<SlTeam> {
  season: number
  // YYYY-MM-DD
  exportedAt: string
  maps: SlMap[]
  prior: number
  alpha: number
  // The strict rule first, then the relaxed one.
  evidence: SlEvidence[]
  flex: { heroes: number; options: number }
  // Rivalry points by level (the index); the opponent stands at the last.
  prices: { paragon: Record<string, number[]>; refinement: number[] }
  // Every hero id in the order of their English names, for ties.
  order: number[]
  before?: SlSeason<SlBeforeTeam> & { season: number }
  beforeUnder?: number
}

// A selected hero at its levels.
export interface SlPick {
  id: number
  faction: string
  paragon: number
  refinement: number
}

export interface SlChoiceTeam {
  // 0 for this season's teams, 1 for the season before's.
  source: number
  // Index into that season's teams.
  team: number
  heroes: number[]
  family: number | null
  rate: number
  chance: number
  // The comp's [players, wins, losses] on this map.
  comp: [number, number, number] | null
  artifact: number | null
  // Index into the team's placements: the board drawn.
  placement: number
  core: number[]
  flex: { out: number; options: number[] }[]
}

export interface SlChoice {
  // Index into SlData.evidence.
  evidence: number
  chance: number
  // The chance of winning each number of maps, 0 to 5.
  odds: number[]
  // One per map, in map order.
  teams: SlChoiceTeam[]
}

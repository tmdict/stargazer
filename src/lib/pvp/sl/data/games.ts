/* This season's decided games as two sides each, the games every model learns
 * from. A game's two sides are consecutive entries of the file's games. */

import type { SlData, SlGame } from './types'

// A recorded team fields five heroes; a team of fewer fills the rest with
// empty slots.
export const TEAM_HEROES = 5

// One team: its heroes, its kind (a group in the data file, null outside
// every group) and its artifact (null for none, counted as a typical one).
export interface Side {
  heroes: number[]
  kind: number | null
  artifact: number | null
}

// The same five heroes in any order give the same key.
export const lineupKey = (heroes: readonly number[]): string =>
  [...heroes].sort((a, b) => a - b).join('/')

// gap: the upgrade gap toward A in Rivalry points.
export interface Game {
  a: Side
  b: Side
  gap: number
  aWon: boolean
}

export function decidedGames(data: SlData): Game[] {
  const side = ([team, , , artifact]: SlGame): Side => ({
    heroes: data.teams[team]!.heroes,
    kind: data.teams[team]!.family,
    artifact,
  })
  const games: Game[] = []
  for (let i = 0; i + 1 < data.games.length; i += 2) {
    const a = data.games[i]!
    if (a[1] === 't') continue
    games.push({ a: side(a), b: side(data.games[i + 1]!), gap: a[2], aWon: a[1] === 'w' })
  }
  return games
}

// Heroes out in the file's season or later that no decided game fields, so the
// model has no number of its own for them.
export function unratedHeroes(
  games: readonly Game[],
  season: number,
  heroes: readonly { id: number; season: number }[],
): Set<number> {
  const fielded = new Set(games.flatMap((g) => [...g.a.heroes, ...g.b.heroes]))
  return new Set(heroes.filter((h) => h.season >= season && !fielded.has(h.id)).map((h) => h.id))
}

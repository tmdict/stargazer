/* A team as the model reads it, and the heroes the file cannot rate yet. */

import type { SlModel } from './types'

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

// Heroes out in the file's season or later that no decided game fields: the
// model has a row for every hero that one does.
export function unratedHeroes(
  model: SlModel,
  season: number,
  heroes: readonly { id: number; season: number }[],
): Set<number> {
  return new Set(heroes.filter((h) => h.season >= season && !model.heroes[h.id]).map((h) => h.id))
}

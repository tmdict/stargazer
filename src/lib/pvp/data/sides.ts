/* A team as the model reads it, and the heroes kept off teams. */

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

// A new hero's first records are too few to judge, so the generator, Generate
// on the Arena and Teams, and Who Would Win? keep every hero released after
// this one off teams, whatever the data file holds. Hero ids follow release
// order.
const NEWEST_HERO_ID = 132

export const withheldHeroes = (heroes: readonly { id: number }[]): Set<number> =>
  new Set(heroes.filter((h) => h.id > NEWEST_HERO_ID).map((h) => h.id))

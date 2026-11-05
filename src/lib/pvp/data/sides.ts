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

// The heroes the generator, Generate on the Arena and Teams, and Who Would Win?
// keep off teams whatever their records, by hero file name.
const WITHHELD = new Set(['baden', 'marene'])

export const withheldHeroes = (heroes: readonly { id: number; name: string }[]): Set<number> =>
  new Set(heroes.filter((h) => WITHHELD.has(h.name)).map((h) => h.id))

/* The lists rules name, read as the placement engine reads them, for the
 * engine's scorer and the Formation rules page alike. */

import type { HeroFilter, ListEntry, PlacementData, PlacementLookups } from './types'

export const matchesFilter = (
  hero: { class: string; range: number; damage: string },
  { class: classes, range, damage }: HeroFilter,
): boolean =>
  (!classes || classes.includes(hero.class)) &&
  (!range || (range === 'melee') === (hero.range === 1)) &&
  (!damage || hero.damage === damage)

// The entry of a list a hero came in by: named in the list itself, brought in
// with another list, or matched by an every entry.
export type ListSource = null | { list: string } | { every: HeroFilter }

// A list's heroes, the lists it brings in included: those above its line in
// order, and those below it, who rank the same. A list brought in above the
// line keeps its own order and line; one brought in below it counts all its
// heroes the same. A hero counts at its first place, so one named again after
// a list that holds it below that list's line stays there.
export interface ListHeroes {
  ranked: number[]
  equal: number[]
  from: Map<number, ListSource>
}

/* `seen` holds the lists on the way down, so a list two others bring in is
 * read for each, and only a list that brings itself in fails (undefined). */
export function expandList(
  lists: PlacementData['lists'],
  name: string,
  lookups: Pick<PlacementLookups, 'heroesMatching'>,
  seen: Set<string> = new Set(),
): ListHeroes | undefined {
  const entries: ListEntry[] | undefined = lists[name]
  if (!entries || seen.has(name)) return undefined
  seen.add(name)
  const found: ListHeroes = { ranked: [], equal: [], from: new Map() }
  const put = (heroes: number[], into: number[], source: ListSource) => {
    for (const hero of heroes) {
      if (found.from.has(hero)) continue
      found.from.set(hero, source)
      into.push(hero)
    }
  }
  let below = false
  for (const entry of entries) {
    if (typeof entry === 'number') put([entry], below ? found.equal : found.ranked, null)
    else if ('line' in entry) below = true
    else if ('every' in entry) put(lookups.heroesMatching(entry.every), found.equal, entry)
    else {
      const more = expandList(lists, entry.list, lookups, seen)
      if (!more) return undefined
      const source = { list: entry.list }
      put(more.ranked, below ? found.equal : found.ranked, source)
      put(more.equal, found.equal, source)
    }
  }
  seen.delete(name)
  return found
}

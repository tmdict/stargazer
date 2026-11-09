/* A list as the lists page draws it: each entry a row, with the place each
 * hero takes. A hero counts at its first place, so a later entry naming it
 * again counts it no more; heroes below the line, or brought in below it, all
 * count the same. */

import type { Lists } from '@/lib/placement/listEdits'
import { expandList } from '@/lib/placement/lists'
import type { HeroFilter, ListEntry } from '@/lib/placement/types'

type HeroesMatching = (filter: HeroFilter) => number[]

// A hero's place on a list: its rank, or 0 below the line.
interface PlacedHero {
  id: number
  place: number
  // An entry above already counts it.
  counted?: boolean
}

export type ListRow =
  | { index: number; kind: 'hero'; hero: PlacedHero }
  | { index: number; kind: 'line'; extra: boolean }
  | {
      index: number
      kind: 'list' | 'every'
      entry: ListEntry
      items: PlacedHero[]
      // A list that brings itself in has no heroes the engine can read.
      loop: boolean
      // An every entry above the line, which has no order of its own.
      above: boolean
      first?: number
      last?: number
    }

export interface ListLayout {
  rows: ListRow[]
  total: number
  ranked: number
  below: number
  hasLine: boolean
  places: Map<number, number>
}

export function listLayout(lists: Lists, name: string, heroesMatching: HeroesMatching): ListLayout {
  const places = new Map<number, number>()
  let rank = 0
  let below = false
  let lines = 0
  const place = (id: number, under: boolean): PlacedHero => {
    const was = places.get(id)
    if (was !== undefined) return { id, place: was, counted: true }
    const at = under ? 0 : ++rank
    places.set(id, at)
    return { id, place: at }
  }
  const rows = (lists[name] ?? []).map((entry, index): ListRow => {
    if (typeof entry === 'number') return { index, kind: 'hero', hero: place(entry, below) }
    if ('line' in entry) {
      below = true
      return { index, kind: 'line', extra: ++lines > 1 }
    }
    const every = 'every' in entry
    const heroes = every
      ? { ranked: [], equal: heroesMatching(entry.every) }
      : expandList(lists, entry.list, { heroesMatching }, new Set([name]))
    const items = heroes
      ? [
          ...heroes.ranked.map((id) => place(id, below)),
          ...heroes.equal.map((id) => place(id, true)),
        ]
      : []
    const ranked = items.filter((item) => item.place && !item.counted)
    return {
      index,
      kind: every ? 'every' : 'list',
      entry,
      items,
      loop: !heroes,
      above: every && !below,
      first: ranked[0]?.place,
      last: ranked.at(-1)?.place,
    }
  })
  const under = [...places.values()].filter((at) => at === 0).length
  return { rows, total: places.size, ranked: rank, below: under, hasLine: lines > 0, places }
}

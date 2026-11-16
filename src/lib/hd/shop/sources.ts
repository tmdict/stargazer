// Reading the shop: which source could have made each card on show.

import type { LevelOdds, ShopCard, SourceEntry } from './types'

/** One way the cards could have come from the sources, with its chance. */
export interface SourceWorld {
  origins: number[]
  chance: number
}

export interface ShopReading {
  /**
   * The level's odds, with a place for every card carried in from a lower
   * level. A locked card keeps its source number when the level rises, so a
   * source can sit behind a product it no longer makes. Listing that product
   * at 0% gives the card a code without changing any draw.
   */
  odds: LevelOdds
  /** The cards that hold a source: every card with a product, then every locked card without one. */
  cards: number[]
  /** How many of `cards`, the last ones, are locked with no product named. */
  blanks: number
  /**
   * The source behind each card of `cards`, in the same order. The sources of
   * the blank cards are in ascending order: one world stands for every way of
   * handing them to those cards, all equally likely.
   */
  worlds: SourceWorld[]
}

const shares = (odds: LevelOdds, good: string): number[] =>
  odds.map((entries) =>
    entries.reduce((sum, entry) => sum + (entry.good === good ? entry.percent / 100 : 0), 0),
  )

/**
 * Every one-to-one match of cards to sources, each with the chance it is the true
 * one given what is on show. Null when no match exists, so the shop as entered
 * cannot happen at this level. `lower` holds the odds of the levels below, the
 * nearest first: a locked card of a product this level never makes is read
 * against the nearest level that makes it.
 */
export function readShop(
  odds: LevelOdds,
  cards: readonly ShopCard[],
  lower: readonly LevelOdds[] = [],
): ShopReading | null {
  const all = cards.map((_, index) => index)
  const named = all.filter((index) => cards[index].good)
  const blank = all.filter((index) => !cards[index].good && cards[index].locked)

  const carried: SourceEntry[][] = odds.map(() => [])
  const likelihood = named.map((index) => {
    const { good, locked } = cards[index]
    const now = shares(odds, good!)
    if (!locked || now.some(Boolean)) return now
    const before = lower.map((level) => shares(level, good!)).find((list) => list.some(Boolean))
    if (!before) return now
    before.forEach((share, source) => {
      if (share && !carried[source].some((entry) => entry.good === good)) {
        carried[source].push({ good: good!, percent: 0 })
      }
    })
    return before
  })

  const worlds: SourceWorld[] = []
  let evidence = 0
  // Every set of sources for the blank cards, lowest first. Each stands for the
  // same number of ways to hand them out, so the sets weigh the same.
  const fill = (left: number, from: number, used: number, chance: number, origins: number[]) => {
    if (!left) {
      worlds.push({ origins, chance })
      evidence += chance
      return
    }
    for (let source = from; source < odds.length; source++) {
      if (!(used & (1 << source))) {
        fill(left - 1, source + 1, used | (1 << source), chance, [...origins, source])
      }
    }
  }
  const place = (index: number, used: number, chance: number, origins: number[]) => {
    if (index === named.length) {
      fill(blank.length, 0, used, chance, origins)
      return
    }
    for (let source = 0; source < odds.length; source++) {
      const share = likelihood[index][source]
      if (!(used & (1 << source)) && share) {
        place(index + 1, used | (1 << source), chance * share, [...origins, source])
      }
    }
  }
  place(0, 0, 1, [])
  if (!evidence) return null
  for (const world of worlds) world.chance /= evidence

  return {
    odds: carried.some((list) => list.length)
      ? odds.map((entries, source) => [...entries, ...carried[source]])
      : odds,
    cards: [...named, ...blank],
    blanks: blank.length,
    worlds,
  }
}

function subsets(size: number, count: number): number[][] {
  if (!count) return [[]]
  const list: number[][] = []
  for (let first = 0; first <= size - count; first++) {
    for (const rest of subsets(size - first - 1, count - 1)) {
      list.push([first, ...rest.map((i) => i + first + 1)])
    }
  }
  return list
}

/**
 * The worlds as the cards of `chosen` alone see them. `chosen` lists places in
 * `reading.cards`, in ascending order, and the origins follow it. Which of the
 * blank cards are chosen changes nothing, only how many: they hold every set
 * of that many of a world's blank sources equally often. The same origins may
 * come up more than once.
 */
export function sourcesOf(reading: ShopReading, chosen: readonly number[]): SourceWorld[] {
  const first = reading.cards.length - reading.blanks
  const named = chosen.filter((place) => place < first)
  const count = chosen.length - named.length
  const sets = subsets(reading.blanks, count)
  return reading.worlds.flatMap((world) =>
    sets.map((set) => ({
      origins: [
        ...named.map((place) => world.origins[place]),
        ...set.map((i) => world.origins[first + i]),
      ],
      chance: world.chance / sets.length,
    })),
  )
}

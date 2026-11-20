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

/* The odds a card with a product is read against. `lower` holds the odds of
 * the levels below, the nearest first. A locked card is read against the
 * level it was locked at, when the card names one, and a locked card of a
 * product this level never makes against the nearest level that makes it. So
 * is a bought card of such a product: it was locked until it was bought. */
function readAt(odds: LevelOdds, card: ShopCard, lower: readonly LevelOdds[]): LevelOdds {
  const { good, locked, bought, lockedAt } = card
  if (!locked && !bought) return odds
  const said = lockedAt === undefined ? undefined : lower[lower.length - lockedAt]
  if (said) return said
  if (shares(odds, good!).some(Boolean)) return odds
  return lower.find((level) => shares(level, good!).some(Boolean)) ?? odds
}

/**
 * Every one-to-one match of cards to sources, each with the chance it is the true
 * one given what is on show. Null when no match exists, so the shop as entered
 * cannot happen at this level (`shopProblems` says why). `lower` holds the odds
 * of the levels below, the nearest first.
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
    const good = cards[index].good!
    const now = shares(odds, good)
    const read = shares(readAt(odds, cards[index], lower), good)
    read.forEach((share, source) => {
      if (share && !now[source] && !carried[source].some((entry) => entry.good === good)) {
        carried[source].push({ good, percent: 0 })
      }
    })
    return read
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

/**
 * Why the cards on show cannot have come from the sources. `unsold`: products
 * the level never sells, on cards neither locked nor bought, and
 * `unsold-lower` the same for products a lower level sells, which a locked
 * card could have kept. `unsold-held`: products of locked or bought cards that
 * no level they can be read at sells. `crowded`: products more cards show than
 * the sources, by index, that make them, when each source makes one card.
 */
export type ShopProblem =
  | { kind: UnsoldKind; goods: string[] }
  | { kind: 'crowded'; goods: string[]; cards: number; sources: number[] }

type UnsoldKind = 'unsold' | 'unsold-lower' | 'unsold-held'
const UNSOLD_KINDS: readonly UnsoldKind[] = ['unsold', 'unsold-lower', 'unsold-held']

/** What keeps `readShop` from reading the shop, or nothing when it can. */
export function shopProblems(
  odds: LevelOdds,
  cards: readonly ShopCard[],
  lower: readonly LevelOdds[] = [],
): ShopProblem[] {
  const unsold = new Map(UNSOLD_KINDS.map((kind) => [kind, new Set<string>()]))
  // Cards that only the same sources make compete as one group.
  const groups = new Map<number, { goods: Set<string>; cards: number }>()
  for (const card of cards) {
    const good = card.good
    if (!good) continue
    const mask = shares(readAt(odds, card, lower), good).reduce(
      (bits, share, source) => (share ? bits | (1 << source) : bits),
      0,
    )
    if (!mask) {
      const lowerSells = lower.some((level) => shares(level, good).some(Boolean))
      const kind =
        card.locked || card.bought ? 'unsold-held' : lowerSells ? 'unsold-lower' : 'unsold'
      unsold.get(kind)!.add(good)
      continue
    }
    const group = groups.get(mask) ?? { goods: new Set<string>(), cards: 0 }
    group.goods.add(good)
    group.cards++
    groups.set(mask, group)
  }

  const problems: ShopProblem[] = UNSOLD_KINDS.flatMap((kind) => {
    const goods = [...unsold.get(kind)!]
    return goods.length ? [{ kind, goods }] : []
  })

  // The fewest groups with more cards between them than sources. The cards
  // with a product have sources one each exactly when no such set exists.
  const list = [...groups]
  let crowded: { picked: number; mask: number; cards: number } | null = null
  for (let picked = 1; picked < 1 << list.length; picked++) {
    let mask = 0
    let count = 0
    list.forEach(([bits, group], i) => {
      if (picked & (1 << i)) {
        mask |= bits
        count += group.cards
      }
    })
    if (count > bitCount(mask) && (!crowded || bitCount(picked) < bitCount(crowded.picked))) {
      crowded = { picked, mask, cards: count }
    }
  }
  if (crowded) {
    const { picked, mask } = crowded
    problems.push({
      kind: 'crowded',
      goods: [
        ...new Set(list.flatMap(([, group], i) => (picked & (1 << i) ? [...group.goods] : []))),
      ],
      cards: crowded.cards,
      sources: odds.flatMap((_, source) => (mask & (1 << source) ? [source] : [])),
    })
  }
  return problems
}

const bitCount = (bits: number): number => {
  let count = 0
  for (let rest = bits; rest; rest &= rest - 1) count++
  return count
}

/** Every way to pick `count` of the numbers below `size`, each in ascending order. */
function combinations(size: number, count: number): number[][] {
  if (!count) return [[]]
  const list: number[][] = []
  for (let first = 0; first <= size - count; first++) {
    for (const rest of combinations(size - first - 1, count - 1)) {
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
  const sets = combinations(reading.blanks, count)
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

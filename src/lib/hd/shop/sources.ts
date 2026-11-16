// Reading the shop: which source could have made each card on show.

import type { LevelOdds, ShopCard } from './types'

/** One way the cards could have come from the sources, with its chance. */
export interface SourceWorld {
  /** The source behind each card of `ShopReading.cards`, in the same order. */
  origins: number[]
  chance: number
}

export interface ShopReading {
  /** The cards that hold a source: every card with a product, and every locked card. */
  cards: number[]
  worlds: SourceWorld[]
}

/**
 * Every one-to-one match of cards to sources, each with the chance it is the true
 * one given what is on show. Null when no match exists, so the shop as entered
 * cannot happen at this level.
 */
export function readShop(odds: LevelOdds, cards: readonly ShopCard[]): ShopReading | null {
  const held = cards.flatMap((card, index) => (card.good || card.locked ? [index] : []))
  const likelihood = held.map((index) => {
    const { good } = cards[index]
    return odds.map((entries) =>
      good ? entries.reduce((sum, e) => sum + (e.good === good ? e.percent / 100 : 0), 0) : 1,
    )
  })

  // The summed weight of every way to place the cards from `index` on, with the
  // sources in `used` taken.
  const rest = new Map<number, number>()
  const weight = (index: number, used: number): number => {
    if (index === held.length) return 1
    const key = index * 256 + used
    const known = rest.get(key)
    if (known !== undefined) return known
    let total = 0
    for (let source = 0; source < odds.length; source++) {
      const share = likelihood[index][source]
      if (!(used & (1 << source)) && share) total += share * weight(index + 1, used | (1 << source))
    }
    rest.set(key, total)
    return total
  }

  const evidence = weight(0, 0)
  if (!evidence) return null

  const worlds: SourceWorld[] = []
  const place = (index: number, used: number, chance: number, origins: number[]) => {
    if (index === held.length) {
      worlds.push({ origins, chance: chance / evidence })
      return
    }
    for (let source = 0; source < odds.length; source++) {
      const share = likelihood[index][source]
      const taken = used | (1 << source)
      if (!(used & (1 << source)) && share && weight(index + 1, taken)) {
        place(index + 1, taken, chance * share, [...origins, source])
      }
    }
  }
  place(0, 0, 1, [])
  return { cards: held, worlds }
}

// Offers only: the best chance of reaching the goal by buying what is on show,
// one purchase at a time, with no reroll. A bought card's place stays empty.

import type { GoalModel } from './moves'
import type { EnteredShop, ShopFacts } from './types'

export interface Offers {
  chance: number
  /** The card to buy first, or null when no purchase can reach the goal. */
  first: number | null
}

/**
 * Purchases with the same chance are tried in `order`, a list of card places,
 * and the first one wins.
 */
export function solveOffers(
  shop: EnteredShop,
  model: GoalModel,
  facts: ShopFacts,
  order: readonly number[],
): Offers {
  const prices = new Map(facts.goods.map((good) => [good.name, good.price]))
  const offers = order.flatMap((card) => {
    const kind = model.kindOf(shop.cards[card])
    const price = prices.get(shop.cards[card].good ?? '')
    return kind >= 0 && price !== undefined
      ? [{ price, card, outcomes: model.kinds[kind].outcomes }]
      : []
  })

  const known = new Map<string, Offers>()
  // `left` has a bit for each offer not bought yet.
  const best = (left: number, badges: number, need: number): Offers => {
    if (need <= 0) return { chance: 1, first: null }
    const key = `${left}|${badges}|${need}`
    const seen = known.get(key)
    if (seen) return seen
    let found: Offers = { chance: 0, first: null }
    for (let i = 0; i < offers.length; i++) {
      const { price, card, outcomes } = offers[i]
      if (!(left & (1 << i)) || price > badges) continue
      let chance = 0
      for (const outcome of outcomes) {
        const rest = left & ~(1 << i)
        chance +=
          outcome.chance * best(rest, badges - price + outcome.refund, need - outcome.gain).chance
      }
      if (chance > found.chance + 1e-12) found = { chance: Math.min(1, chance), first: card }
    }
    known.set(key, found)
    return found
  }

  return best((1 << offers.length) - 1, Math.max(0, shop.badges), model.need)
}

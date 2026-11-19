// The shop's own facts: prices, what each product gives, the reroll fee and the
// sale value of a hero card.

import shop from '@/data/hd/shop/shop.json'
import type { Good, ShopFacts } from './types'

/** The most badges a purchase can hand back when every hero it gives is sold. */
function highestRefund(good: Good, sell: number): number {
  if (good.kind === 'pack') return (good.draws ?? 0) * sell
  if (good.kind === 'legendary') return (good.copies ?? 0) * sell
  return 0
}

/**
 * Returns the facts unchanged, or throws. The solvers fill their tables from the
 * fewest badges up, which is only sound while every move leaves fewer badges
 * than before.
 */
function checkShopFacts(facts: ShopFacts): ShopFacts {
  if (facts.reroll <= 0) throw new Error('shop: a reroll has to cost badges')
  for (const good of facts.goods) {
    if (highestRefund(good, facts.sell) >= good.price) {
      throw new Error(`shop: ${good.name} can hand back its own price`)
    }
  }
  return facts
}

export const SHOP_FACTS: ShopFacts = checkShopFacts(shop as ShopFacts)

/** A product that picks heroes at random: a pack or the Random Legendary. */
export function drawsHeroes(good: Good): boolean {
  return good.kind === 'pack' || good.kind === 'legendary'
}

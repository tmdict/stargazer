// An example shop: what a fresh shop of one level could show.

import type { EquipmentTier } from '@/lib/types/honorDuel'
import type { LevelOdds, ShopCard, ShopFacts } from './types'

export interface SamplePools {
  /** The heroes a hero card can name. */
  heroes: readonly string[]
  /** The pieces an equipment card can name. */
  equipment: readonly { name: string; tier: EquipmentTier }[]
}

/**
 * One card from each source at its odds, a hero card or an equipment card
 * naming one of `pools`. The cards come back in a random order, since a card's
 * place on screen says nothing of its source. `random` gives a number from 0 up
 * to, not including, 1.
 */
export function sampleShop(
  odds: LevelOdds,
  facts: ShopFacts,
  pools: SamplePools,
  random: () => number = Math.random,
): ShopCard[] {
  const goods = new Map(facts.goods.map((good) => [good.name, good]))
  const pick = <T>(list: readonly T[]): T | undefined => list[Math.floor(random() * list.length)]

  const cards = odds.map((entries): ShopCard => {
    const total = entries.reduce((sum, entry) => sum + entry.percent, 0)
    let left = random() * total
    const entry = entries.find((one) => (left -= one.percent) < 0) ?? entries.at(-1)
    const good = goods.get(entry?.good ?? '')
    const card: ShopCard = { good: good?.name ?? null, locked: false, bought: false }
    if (good?.kind === 'hero') {
      const hero = pick(pools.heroes)
      if (hero) card.hero = hero
    }
    if (good?.kind === 'equipment') {
      const piece = pick(pools.equipment.filter((one) => one.tier === good.tier))
      if (piece) card.equipment = piece.name
    }
    return card
  })

  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    const moved = cards[i]!
    cards[i] = cards[j]!
    cards[j] = moved
  }
  return cards
}

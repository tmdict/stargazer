// What a draw can pick: the heroes and equipment in the shop's pools, and the
// chance a pick is one the player wants.

import type { DuelEquipment, EquipmentTier } from '@/lib/types/honorDuel'
import type { Good, PoolHero, Pools, ShopFacts } from './types'

/** The pools for one request: the shop's heroes less the Mythic ones, and its equipment by tier. */
export function shopPools(
  facts: ShopFacts,
  factionOf: (hero: string) => string,
  equipment: readonly DuelEquipment[],
  mythic: Iterable<string>,
  sell: Iterable<string>,
): Pools {
  const out = new Set(mythic)
  const counts: Partial<Record<EquipmentTier, number>> = {}
  for (const piece of equipment) {
    if (piece.shop) counts[piece.tier] = (counts[piece.tier] ?? 0) + 1
  }
  return {
    heroes: facts.heroes
      .filter((name) => !out.has(name))
      .map((name) => ({ name, faction: factionOf(name) })),
    sell: new Set(sell),
    equipment: counts,
  }
}

/** The heroes a pack or the Random Legendary picks from. */
export function drawPool(pools: Pools, good: Good): PoolHero[] {
  return good.faction ? pools.heroes.filter((hero) => hero.faction === good.faction) : pools.heroes
}

/**
 * The chance one pick from `pool` lands in `names`. The game does not show how
 * it picks, so every hero in a pool is taken as equally likely; the same goes
 * for the pieces of an equipment tier.
 */
export function evenShare(pool: readonly PoolHero[], names: ReadonlySet<string>): number {
  if (!pool.length) return 0
  return pool.filter((hero) => names.has(hero.name)).length / pool.length
}

/** The chance an equipment card of `tier` is one of `wanted` pieces of that tier. */
export function equipmentShare(pools: Pools, tier: EquipmentTier, wanted: number): number {
  const size = pools.equipment[tier] ?? 0
  return size ? wanted / size : 0
}

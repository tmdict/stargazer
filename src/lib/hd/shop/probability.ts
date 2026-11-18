// The shop's chances in closed form, for the probability guide's tables.

import type { LevelOdds } from './types'

/** The chance at least one of several independent events happens. */
const anyOf = (chances: readonly number[]): number =>
  1 - chances.reduce((miss, chance) => miss * (1 - chance), 1)

/** The chance a pack of `draws` picks, repeats allowed, gives one of `wanted` heroes out of `pool`. */
export const packChance = (wanted: number, pool: number, draws: number): number =>
  pool > 0 ? 1 - (1 - Math.min(wanted, pool) / pool) ** draws : 0

/**
 * The chance a fresh shop shows a wanted card. `share` is the chance a card of
 * a product is a wanted one: 1 for the product itself, a hero's share of the
 * pool for a hero card.
 */
export const showChance = (sources: LevelOdds, share: (good: string) => number): number =>
  anyOf(
    sources.map((entries) =>
      entries.reduce((sum, entry) => sum + (entry.percent / 100) * share(entry.good), 0),
    ),
  )

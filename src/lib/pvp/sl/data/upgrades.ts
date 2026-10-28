/* A hero's Rivalry points at its upgrade levels, at the data file's prices,
 * for the upgrade gaps both pages count. */

import type { SlPrices } from './types.ts'

export interface SlLevels {
  faction: string
  paragon: number
  refinement: number
}

export const rivalryPoints = (prices: SlPrices, hero: SlLevels): number =>
  prices.paragon[hero.faction]![hero.paragon]! + prices.refinement[hero.refinement]!

const topPoints = (prices: SlPrices, faction: string): number =>
  prices.paragon[faction]!.at(-1)! + prices.refinement.at(-1)!

// What a hero falls short of the top levels, in Rivalry points.
export const shortfall = (prices: SlPrices, hero: SlLevels): number =>
  topPoints(prices, hero.faction) - rivalryPoints(prices, hero)

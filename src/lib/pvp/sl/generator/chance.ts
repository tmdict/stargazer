/* A team's chance to win one board, as the generator counts it for a chosen
 * team and for a swap tried on it. */

import type { Side } from '../data/sides'
import type { SlPrices } from '../data/types'
import { shortfall, type SlLevels } from '../data/upgrades'
import { sigmoid } from '../model/odds'
import type { Model } from '../model/types'

// What the heroes at the visitor's levels fall short of the top levels, in
// Rivalry points, as the model's gap.
export const levelGap = (
  prices: SlPrices,
  levels: ReadonlyMap<number, SlLevels>,
  heroes: readonly number[],
): number => -heroes.reduce((n, id) => n + shortfall(prices, levels.get(id)!), 0)

// The model's chance against a typical opponent, its odds scaled by the share
// of the team's own effects the board's map leaves it (fit.ts).
export const boardChance = (model: Model, side: Side, gap: number, share = 1): number =>
  sigmoid(model.againstTypical(side, gap) + Math.log(share))

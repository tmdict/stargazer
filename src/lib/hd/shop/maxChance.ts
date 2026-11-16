// Best chance: for one goal and the shop as entered, the chance of reaching the
// goal after each first move when every later move is the best one.

import { goalModel } from './moves'
import type { Outlook } from './search'
import { createSolverCache, type SolverCache } from './solverCache'
import { readShop } from './sources'
import type { ChanceRange, EnteredShop, Goal, LevelOdds, Move, Pools, ShopFacts } from './types'

export interface MaxChance {
  /** What the tables alone say about a first move. Quick, and never wrong. */
  range: (move: Move) => ChanceRange
  /**
   * The chance after a first move, within the cache's tolerance. Throws
   * `OutOfTime` once `deadline`, a `performance.now()` time, passes.
   */
  chance: (move: Move, deadline?: number) => number
}

/**
 * Null when the shop as entered cannot happen at this level. A cache passed in
 * `kept` carries the tables and the searched shops from one call to the next.
 */
export function solveMaxChance(
  shop: EnteredShop,
  goal: Goal,
  odds: LevelOdds,
  pools: Pools,
  facts: ShopFacts,
  kept: SolverCache = createSolverCache(),
): MaxChance | null {
  const reading = readShop(odds, shop.cards)
  if (!reading) return null
  const model = goalModel(goal, odds, pools, facts)
  const badges = Math.max(0, shop.badges)
  const { search } = kept.solver(model, badges)
  const prices = new Map(facts.goods.map((good) => [good.name, good.price]))

  const at = new Map(reading.cards.map((card, i) => [card, i]))
  const start = search.board(
    reading.cards.map((card) => model.kindOf(shop.cards[card])),
    reading.worlds,
  )

  const after = (move: Move, next: Outlook): number => {
    if (move.kind === 'reroll') {
      if (badges < model.reroll) return 0
      const locked = search.project(
        start,
        move.locks.flatMap((card) => at.get(card) ?? []),
      )
      return next.afterRoll(locked, badges - model.reroll, model.need)
    }
    const card = shop.cards[move.card]
    const i = at.get(move.card)
    if (i === undefined || !card.good || card.bought) return 0
    if (start.items[i] >= 0) return next.afterBuy(start, i, badges, model.need)
    // A card that cannot help the goal still costs its price, and a pack may
    // hand badges back for the heroes it gives.
    const left = badges - (prices.get(card.good) ?? Infinity)
    if (left < 0) return 0
    const rest = search.project(
      start,
      start.items.map((_, j) => j).filter((j) => j !== i),
    )
    return model
      .wasted(card)
      .reduce((sum, o) => sum + o.chance * next.from(rest, left + o.refund, model.need), 0)
  }

  return {
    range: (move) => ({ floor: after(move, search.floor), ceiling: after(move, search.ceiling) }),
    chance: (move, deadline = Infinity) => {
      search.stats.deadline = deadline
      return after(move, search.value)
    },
  }
}

// Best chance: for one goal and the shop as entered, the chance of reaching the
// goal after each first move when every later move is the best one.

import { goalModel } from './moves'
import { makeSearch, type Outlook, type Search } from './search'
import { readShop } from './sources'
import { buildTables } from './tables'
import type { ChanceRange, EnteredShop, Goal, LevelOdds, Move, Pools, ShopFacts } from './types'

export interface MaxChance {
  /** What the tables alone say about a first move. Quick, and never wrong. */
  range: (move: Move) => ChanceRange
  /**
   * The chance after a first move, within the tolerance. Throws `OutOfTime` once
   * `search.stats.deadline` passes.
   */
  chance: (move: Move) => number
  search: Search
  /** The size of the tables in memory. */
  bytes: number
}

/** Null when the shop as entered cannot happen at this level. */
export function solveMaxChance(
  shop: EnteredShop,
  goal: Goal,
  odds: LevelOdds,
  pools: Pools,
  facts: ShopFacts,
  tolerance = 1e-6,
): MaxChance | null {
  const reading = readShop(odds, shop.cards)
  if (!reading) return null
  const model = goalModel(goal, odds, pools, facts, shop.cards)
  const badges = Math.max(0, shop.badges)
  const tables = buildTables(model, badges)
  const search = makeSearch(model, tables, tolerance)
  const prices = new Map(facts.goods.map((good) => [good.name, good.price]))

  const at = new Map(reading.cards.map((card, i) => [card, i]))
  const start = search.board(
    reading.cards.map((card) => model.kindOf(shop.cards[card])),
    reading.worlds,
  )

  const after = (move: Move, next: Outlook): number => {
    if (move.kind === 'reroll') {
      if (badges < model.reroll) return 0
      const kept = search.project(
        start,
        move.locks.flatMap((card) => at.get(card) ?? []),
      )
      return search.afterRoll(kept, badges - model.reroll, model.need, next)
    }
    const card = shop.cards[move.card]
    const i = at.get(move.card)
    if (i === undefined || !card.good || card.bought) return 0
    if (start.items[i] >= 0) return search.afterBuy(start, i, badges, model.need, next)
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
      .reduce((sum, o) => sum + o.chance * next(rest, left + o.refund, model.need), 0)
  }

  return {
    range: (move) => ({ floor: after(move, search.floor), ceiling: after(move, search.ceiling) }),
    chance: (move) => after(move, search.value),
    search,
    bytes: tables.bytes,
  }
}

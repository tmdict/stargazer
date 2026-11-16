// Fewest badges: for one goal and the shop as entered, the badges spent on
// average until the goal is reached, after each first move, for a player who
// never runs out and makes the cheapest move from then on.

import type { Costs } from './costs'
import { goalModel, type GoalModel } from './moves'
import { createSolverCache, type SolverCache } from './solverCache'
import { readShop, type ShopReading } from './sources'
import type { CostRange, EnteredShop, Goal, LevelOdds, Move, Pools, ShopFacts } from './types'

/** Costs this close count as equal when a move is picked. */
export const NEAR_TIE = 0.05

const FREE: CostRange = { floor: 0, ceiling: 0 }

/** Orders two costs, taking ones that differ only by rounding as equal. */
export function cheaper(a: CostRange, b: CostRange): number {
  return Math.abs(a.ceiling - b.ceiling) < 1e-9 ? 0 : a.ceiling - b.ceiling
}

/** The cards as entered, read through one goal's cost tables. */
export interface CostView {
  /** The useful kind of a card, or -1. */
  kindOf: (card: number) => number
  /** From the cards on show, less the card `gone`. */
  from: (need: number, gone?: number) => CostRange
  /** From the shop a redraw leaves when `locks` are kept. The redraw's own price is not counted. */
  afterRoll: (locks: readonly number[], need: number) => CostRange
  /** Buying a card: its price, less the badges sold heroes give back, then `next`. */
  buy: (card: number, next: (need: number) => CostRange) => CostRange
}

/**
 * `reading` says which source each card may hold. `model` and `costs` may be
 * those of another level, when the cards are carried into it.
 */
export function costView(
  shop: EnteredShop,
  reading: ShopReading,
  model: GoalModel,
  costs: Costs,
  facts: ShopFacts,
): CostView {
  const { addOf } = costs.layout
  const prices = new Map(facts.goods.map((good) => [good.name, good.price]))
  const at = new Map(reading.cards.map((card, i) => [card, i]))
  const kinds = reading.cards.map((card) => model.kindOf(shop.cards[card]))
  const useful = kinds.flatMap((kind, i) => (kind >= 0 ? [i] : []))
  const kindOf = (card: number) => kinds[at.get(card) ?? -1] ?? -1

  // The chance of each code the chosen cards can form, together with the
  // sources behind the chosen cards that cannot help.
  const spread = (chosen: readonly number[]) => {
    const merged = new Map<number, number>()
    for (const world of reading.worlds) {
      let code = 0
      let held = 0
      for (const i of chosen) {
        const source = world.origins[i]
        const add = kinds[i] >= 0 ? addOf[source].get(kinds[i]) : undefined
        if (add === undefined) held |= 1 << source
        else code += add
      }
      const key = code * 256 + held
      merged.set(key, (merged.get(key) ?? 0) + world.chance)
    }
    return merged
  }

  return {
    kindOf,
    from(need, gone) {
      if (need <= 0) return FREE
      const skip = gone === undefined ? undefined : at.get(gone)
      let floor = 0
      let ceiling = 0
      for (const [key, chance] of spread(useful.filter((i) => i !== skip))) {
        const code = Math.floor(key / 256)
        floor += chance * costs.floor[need][code]
        ceiling += chance * costs.ceiling[need][code]
      }
      return { floor, ceiling }
    },
    afterRoll(locks, need) {
      if (need <= 0) return FREE
      let floor = 0
      let ceiling = 0
      for (const [key, chance] of spread(locks.flatMap((card) => at.get(card) ?? []))) {
        const rolled = costs.rolled(need, key % 256)
        const code = Math.floor(key / 256)
        floor += chance * rolled.floor[code]
        ceiling += chance * rolled.ceiling[code]
      }
      return { floor, ceiling }
    },
    buy(card, next) {
      const shown = shop.cards[card]
      const kind = kindOf(card)
      const price = prices.get(shown.good ?? '') ?? Infinity
      const outcomes = kind >= 0 ? model.kinds[kind].outcomes : model.wasted(shown)
      let floor = price
      let ceiling = price
      for (const outcome of outcomes) {
        const after = next(model.need - outcome.gain)
        floor += outcome.chance * (after.floor - outcome.refund)
        ceiling += outcome.chance * (after.ceiling - outcome.refund)
      }
      return { floor, ceiling }
    },
  }
}

export interface CostRow {
  move: Move
  cost: CostRange
}

export interface MinBadges {
  /** Whether a reroll can ever show something that helps the goal. */
  reachable: boolean
  /**
   * The first moves compared, in groups of moves that differ only in locks of
   * no use to this goal. Buying each different card that can help is a group
   * of one. A reroll may keep cards of the wanted hero that together hold fewer
   * copies than are still needed, and a group holds the rerolls that keep the
   * same such cards, one for each choice among the other locks already set.
   */
  options: Move[][]
  /**
   * The average cost after a first move. The true figure lies in the range, and
   * the ceiling is the one a player can count on.
   */
  cost: (move: Move) => CostRange
  /**
   * The cheapest of `moves` that can help this goal. Among moves within
   * `NEAR_TIE` of it, a purchase comes first, then the reroll that keeps more of
   * the locks already set on cards of no use to this goal, then fewer locks.
   */
  best: (moves: readonly Move[]) => CostRow | null
}

/** Null when the shop as entered cannot happen at this level. */
export function solveMinBadges(
  shop: EnteredShop,
  goal: Goal,
  odds: LevelOdds,
  pools: Pools,
  facts: ShopFacts,
  kept: SolverCache = createSolverCache(),
): MinBadges | null {
  const reading = readShop(odds, shop.cards)
  if (!reading) return null
  const model = goalModel(goal, odds, pools, facts)
  const costs = kept.costs(model)
  const view = costView(shop, reading, model, costs, facts)

  const cost = (move: Move): CostRange => {
    if (move.kind === 'buy') return view.buy(move.card, (need) => view.from(need, move.card))
    const after = view.afterRoll(move.locks, model.need)
    return { floor: model.reroll + after.floor, ceiling: model.reroll + after.ceiling }
  }

  const others = shop.cards.flatMap((card, index) =>
    card.locked && !card.bought && view.kindOf(index) < 0 ? [index] : [],
  )
  const keeps = (move: Move) =>
    move.kind === 'buy' ? others.length : others.filter((card) => move.locks.includes(card)).length
  const locks = (move: Move) => (move.kind === 'buy' ? 0 : move.locks.length)

  // Cards of one kind are interchangeable, so a reroll keeps the first few.
  const partial = new Map<number, number[]>()
  const offers = new Map<string, number>()
  shop.cards.forEach((card, index) => {
    const kind = view.kindOf(index)
    if (kind < 0) return
    const key = JSON.stringify([card.good, card.hero, card.equipment])
    if (!offers.has(key)) offers.set(key, index)
    if (model.kinds[kind].certain) partial.set(kind, [...(partial.get(kind) ?? []), index])
  })
  let own: { cards: number[]; gain: number }[] = [{ cards: [], gain: 0 }]
  for (const [kind, held] of partial) {
    const each = model.kinds[kind].outcomes[0].gain
    own = own.flatMap((set) =>
      held
        .flatMap((_, count) => {
          const gain = set.gain + each * (count + 1)
          return gain < model.need
            ? [{ cards: [...set.cards, ...held.slice(0, count + 1)], gain }]
            : []
        })
        .concat(set),
    )
  }
  // Locked cards with no product named are interchangeable too: which of them
  // a reroll keeps changes nothing, only how many.
  const named = others.filter((card) => shop.cards[card].good)
  const blank = others.filter((card) => !shop.cards[card].good)
  const spare = Array.from({ length: 1 << named.length }, (_, mask) =>
    named.filter((_, bit) => (mask >> bit) & 1),
  ).flatMap((set) =>
    Array.from({ length: blank.length + 1 }, (_, n) => [...set, ...blank.slice(0, n)]),
  )
  const options: Move[][] = [...offers.values()].map((card) => [{ kind: 'buy', card }])
  for (const set of own) {
    const rerolls = spare
      .map((extra) => [...set.cards, ...extra].sort((a, b) => a - b))
      .filter((locks) => locks.length < shop.cards.length)
    if (rerolls.length) options.push(rerolls.map((locks) => ({ kind: 'reroll', locks })))
  }

  return {
    reachable: costs.reachable,
    options,
    cost,
    best(moves) {
      const rows = moves
        .filter((move) => move.kind === 'reroll' || view.kindOf(move.card) >= 0)
        .map((move) => ({ move, cost: cost(move) }))
        .filter((row) => Number.isFinite(row.cost.ceiling))
      if (!rows.length) return null
      const least = Math.min(...rows.map((row) => row.cost.ceiling))
      return rows
        .filter((row) => row.cost.ceiling - least < NEAR_TIE)
        .sort(
          (a, b) =>
            Number(b.move.kind === 'buy') - Number(a.move.kind === 'buy') ||
            keeps(b.move) - keeps(a.move) ||
            locks(a.move) - locks(b.move) ||
            cheaper(a.cost, b.cost),
        )[0]
    },
  }
}

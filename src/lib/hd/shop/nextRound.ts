// Stopping for the round: what each way to stop costs from the next round on,
// when the next shop is a free redraw of the unlocked cards and every shop after
// it costs a reroll, and when fewest badges says to stop at all.

import { cheaper, costView, NEAR_TIE, type CostRow } from './minBadges'
import { goalModel } from './moves'
import { createSolverCache, type SolverCache } from './solverCache'
import type { ShopReading } from './sources'
import type {
  CostRange,
  EnteredShop,
  Goal,
  LevelOdds,
  Move,
  Pools,
  ShopCard,
  ShopFacts,
  SourceEntry,
} from './types'

/** A chance below this shows as 0.00%. */
export const SHOWS_AS_ZERO = 5e-5

/** One way to stop: the locks left set, after buying the card `buy`, if any. */
export interface StopPlan {
  locks: number[]
  buy: number | null
  cost: CostRange
}

export interface NextRound {
  cost: (locks: readonly number[], buy: number | null) => CostRange
  /**
   * The ways to stop: with the locks of each reroll in `moves`, and after each
   * purchase in `moves` that helps the goal and the badges allow, with the
   * locks already set either all kept or all let go.
   */
  plans: (moves: readonly Move[]) => StopPlan[]
  /**
   * The cheapest plan. Among plans within `NEAR_TIE` of it, the one that gives
   * up fewer of the locks already set comes first, then one that buys nothing,
   * then one that adds fewer locks.
   */
  best: (moves: readonly Move[]) => StopPlan | null
}

/**
 * The next level's odds with a place for every card that may be carried into
 * it, as `ShopReading.odds` has for the cards carried into this one.
 */
function carriedOdds(next: LevelOdds, cards: readonly ShopCard[], reading: ShopReading): LevelOdds {
  const extra: SourceEntry[][] = next.map(() => [])
  reading.cards.forEach((card, i) => {
    const { good, bought } = cards[card]
    if (!good || bought) return
    for (const world of reading.worlds) {
      const source = world.origins[i]
      const known = [...next[source], ...extra[source]].some((entry) => entry.good === good)
      if (!known) extra[source].push({ good, percent: 0 })
    }
  })
  return next.map((entries, source) => [...entries, ...extra[source]])
}

/**
 * `reading` is the shop's cards as read at its level. `nextOdds` is the next
 * level's table when the shop level rises next round, else null.
 */
export function solveNextRound(
  shop: EnteredShop,
  goal: Goal,
  reading: ShopReading,
  nextOdds: LevelOdds | null,
  pools: Pools,
  facts: ShopFacts,
  kept: SolverCache = createSolverCache(),
): NextRound {
  const then = nextOdds ? carriedOdds(nextOdds, shop.cards, reading) : reading.odds
  const model = goalModel(goal, then, pools, facts)
  const view = costView(shop, reading, model, kept.costs(model), facts)
  const prices = new Map(facts.goods.map((good) => [good.name, good.price]))

  const cost = (locks: readonly number[], buy: number | null): CostRange => {
    if (buy === null) return view.afterRoll(locks, model.need)
    const rest = locks.filter((card) => card !== buy)
    return view.buy(buy, (need) => view.afterRoll(rest, need))
  }

  const existing = shop.cards.flatMap((card, i) => (card.locked && !card.bought ? [i] : []))
  const released = (plan: StopPlan) => existing.filter((card) => !plan.locks.includes(card)).length
  const added = (plan: StopPlan) => plan.locks.filter((card) => !existing.includes(card)).length

  const plans = (moves: readonly Move[]): StopPlan[] => {
    const list: StopPlan[] = []
    for (const move of moves) {
      if (move.kind === 'reroll') {
        list.push({ locks: move.locks, buy: null, cost: cost(move.locks, null) })
        continue
      }
      const price = prices.get(shop.cards[move.card].good ?? '') ?? Infinity
      if (view.kindOf(move.card) < 0 || price > shop.badges) continue
      const held = existing.filter((card) => card !== move.card)
      for (const locks of held.length ? [held, []] : [held]) {
        list.push({ locks, buy: move.card, cost: cost(locks, move.card) })
      }
    }
    return list
  }

  return {
    cost,
    plans,
    best(moves) {
      const list = plans(moves).filter((plan) => Number.isFinite(plan.cost.ceiling))
      if (!list.length) return null
      const least = Math.min(...list.map((plan) => plan.cost.ceiling))
      return list
        .filter((plan) => plan.cost.ceiling - least < NEAR_TIE)
        .sort(
          (a, b) =>
            released(a) - released(b) ||
            Number(a.buy !== null) - Number(b.buy !== null) ||
            added(a) - added(b) ||
            cheaper(a.cost, b.cost),
        )[0]
    },
  }
}

export type StopReason = 'unaffordable' | 'impossible' | 'next-level'

/**
 * Why fewest badges says to stop in place of its cheapest move, or null when
 * the move stands. The cost assumes badges never run out, so the move is
 * checked against the badges in hand: a purchase they cannot pay for, or a move
 * after which `chanceAfter`, the best chance this round, shows as zero. `wait`
 * is the best stopping plan when the shop level rises next round. Waiting has
 * to win by more than a reroll, so that the saving comes from the better shop
 * and not from the free redraw.
 */
export function stopReason(
  best: CostRow,
  shop: EnteredShop,
  facts: ShopFacts,
  chanceAfter: (move: Move) => number,
  wait: StopPlan | null = null,
): StopReason | null {
  const { move } = best
  if (move.kind === 'buy') {
    const good = facts.goods.find((g) => g.name === shop.cards[move.card].good)
    if (!good || good.price > shop.badges) return 'unaffordable'
  }
  if (chanceAfter(move) < SHOWS_AS_ZERO) return 'impossible'
  if (wait && wait.cost.ceiling + facts.reroll < best.cost.ceiling - NEAR_TIE) return 'next-level'
  return null
}

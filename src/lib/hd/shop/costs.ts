// Two tables that bracket the fewest badges, on average, to reach a goal from
// any later shop, for a player who never runs out. They use the codes of
// `tables.ts` and have no badge count in them.
//
// The floor table is the cost for a player who is told the sources, so it is
// never too high. The ceiling table is the cost of one plan that picks a move
// from the kinds on show alone, so a real player can follow it and it is never
// too low. A reroll can lead back to the same shop, so each table is redone
// until its numbers stop moving.

import type { GoalModel } from './moves'
import type { Layout, ShownCard } from './tables'

/** Tables indexed `[targets still needed]`, each one value per code. */
export interface Costs {
  layout: Layout
  /** Whether a reroll can ever show something that helps the goal. */
  reachable: boolean
  floor: Float64Array[]
  ceiling: Float64Array[]
  /** Fills the tables still missing for up to `need` targets. */
  cover: (need: number) => void
  /**
   * The two tables for the cards kept through a reroll, before the new cards
   * show. `held` is a bit mask of sources that sit behind kept cards of no use.
   */
  rolled: (need: number, held: number) => { floor: Float64Array; ceiling: Float64Array }
  /** An estimate of the size in memory of the filled tables. */
  readonly bytes: number
}

// A table is settled once no number moves by more than this in a pass.
const SETTLED = 1e-10
// A plan that never reaches the goal would otherwise be redone for ever.
const RUNAWAY = 1e9
// How many times the plan is picked again from its own cost.
const PLAN_ROUNDS = 8
// Passes shrink the distance to the answer by a steady share once they settle
// into a rhythm. Two shares in a row this close count as steady, and a share
// this close to 1 is not shrinking yet.
const STEADY = 1e-3

/**
 * Repeats `pass`, which redoes `values` in place and returns the largest move,
 * until nothing moves. Once the moves shrink by a steady share, the rest of the
 * way is the sum of a geometric series, so the values jump there and the passes
 * that follow only correct the jump. False when the values grow without end.
 */
function settle(values: Float64Array, pass: () => number): boolean {
  const before = new Float64Array(values.length)
  let last = Infinity
  let lastShare = Infinity
  for (;;) {
    before.set(values)
    const change = pass()
    if (change < SETTLED) return true
    if (!(change < RUNAWAY)) return false
    const share = change / last
    if (share < 1 - STEADY && Math.abs(share - lastShare) < STEADY) {
      const rest = share / (1 - share)
      for (let i = 0; i < values.length; i++) values[i] += (values[i] - before[i]) * rest
      last = Infinity
      lastShare = Infinity
    } else {
      last = change
      lastShare = share
    }
  }
}

export function createCosts(model: GoalModel, layout: Layout): Costs {
  const { kinds, sources, reroll } = model
  const { size, cards, weight, lockSets, classes, fold } = layout
  const reachable = sources.some((source) => source.chances.some((chance) => chance > 0))

  // Row 0 stays empty: with no target left the cost is 0.
  const floor: Float64Array[] = [new Float64Array(0)]
  const ceiling: Float64Array[] = [new Float64Array(0)]
  const rolledTables = new Map<number, { floor: Float64Array; ceiling: Float64Array }>()

  // A pack that gives no target leaves the same count needed, so its cost
  // reads `current`, the table being filled.
  const buy = (
    table: Float64Array[],
    current: Float64Array,
    n: number,
    code: number,
    card: ShownCard,
  ) => {
    const kind = kinds[card.kind]
    const rest = code - card.add
    let sum = kind.good.price
    for (const outcome of kind.outcomes) {
      const left = n - outcome.gain
      const after = left <= 0 ? 0 : outcome.gain ? table[left][rest] : current[rest]
      sum += outcome.chance * (after - outcome.refund)
    }
    return sum
  }

  const fillFloor = (n: number) => {
    const values = new Float64Array(size)
    settle(values, () => {
      const rolled = fold(values)
      let change = 0
      for (let code = 0; code < size; code++) {
        let best = Infinity
        for (const card of cards[code]) best = Math.min(best, buy(floor, values, n, code, card))
        const sets = lockSets[code]
        for (let i = 0; i < sets.length; i++) best = Math.min(best, reroll + rolled[sets[i]])
        change = Math.max(change, Math.abs(best - values[code]))
        values[code] = best
      }
      return change
    })
    return values
  }

  // A class with no chance of showing in a fresh shop holds only cards carried
  // in from another level; its codes then count alike.
  const classWeights = classes.map((group) => {
    const list = group.codes.map((code) => weight[code])
    return list.some((value) => value > 0) ? list : list.map(() => 1)
  })

  /**
   * What each move of a class costs in each of its codes, given `values` for
   * the shops that follow: first buying a card of each kind on show, then each
   * way to keep cards through a reroll. A player cannot tell cards of one kind
   * apart, so each is as likely as the next to be the one bought or kept.
   */
  const moveCost = (
    group: Layout['classes'][number],
    option: number,
    slot: number,
    n: number,
    values: Float64Array,
    rolled: Float64Array,
  ) => {
    if (option < group.present.length) {
      const mine = group.sameKind[option][slot]
      let sum = 0
      for (const card of mine) sum += buy(ceiling, values, n, group.codes[slot], card)
      return sum / mine.length
    }
    const way = option - group.present.length
    const from = group.keptFrom[slot * group.keeps + way]
    const to = group.keptFrom[slot * group.keeps + way + 1]
    let sum = 0
    for (let i = from; i < to; i++) sum += rolled[group.kept[i]]
    return reroll + sum / (to - from)
  }

  // For each class, the move that is cheapest on average over its codes.
  const choose = (n: number, values: Float64Array) => {
    const rolled = fold(values)
    return classes.map((group, g) => {
      const options = group.present.length + group.keeps
      let pick = 0
      let least = Infinity
      for (let option = 0; option < options; option++) {
        let score = 0
        for (let slot = 0; slot < group.codes.length; slot++) {
          score += classWeights[g][slot] * moveCost(group, option, slot, n, values, rolled)
        }
        if (score < least - 1e-12) {
          least = score
          pick = option
        }
      }
      return pick
    })
  }

  // The cost of a plan, or null for a plan that never reaches the goal. It
  // starts at the floor, which is close when the plan is a good one.
  const follow = (n: number, plan: number[]) => {
    const values = Float64Array.from(floor[n])
    const settled = settle(values, () => {
      const rolled = fold(values)
      let change = 0
      classes.forEach((group, g) => {
        for (let slot = 0; slot < group.codes.length; slot++) {
          const code = group.codes[slot]
          const value = moveCost(group, plan[g], slot, n, values, rolled)
          change = Math.max(change, Math.abs(value - values[code]))
          values[code] = value
        }
      })
      return change
    })
    return settled ? values : null
  }

  const fresh = (values: Float64Array) => fold(values)[0]

  const fillCeiling = (n: number) => {
    let plan = choose(n, floor[n])
    let best = follow(n, plan)
    for (let round = 0; best && round < PLAN_ROUNDS; round++) {
      const next = choose(n, best)
      if (next.every((pick, g) => pick === plan[g])) break
      const values = follow(n, next)
      if (!values || fresh(values) >= fresh(best)) break
      plan = next
      best = values
    }
    if (!best) throw new Error('shop: the plan picked for the cost ceiling never reaches the goal')
    return best
  }

  // With nothing useful to come, only the cards already kept can reach the
  // goal: one pass of purchases, each code after the codes with fewer cards.
  const fillFromCards = (n: number) => {
    const values = new Float64Array(size).fill(Infinity)
    for (let code = 0; code < size; code++) {
      for (const card of cards[code]) {
        values[code] = Math.min(values[code], buy(floor, values, n, code, card))
      }
    }
    return values
  }

  const cover = (need: number) => {
    for (let n = floor.length; n <= need; n++) {
      if (!reachable) {
        floor.push(fillFromCards(n))
        ceiling.push(floor[n])
        continue
      }
      floor.push(fillFloor(n))
      ceiling.push(fillCeiling(n))
    }
  }

  return {
    layout,
    reachable,
    floor,
    ceiling,
    cover,
    rolled(need, held) {
      // A redraw that shows nothing useful leaves the kept cards as they are.
      if (!reachable) return { floor: floor[need], ceiling: ceiling[need] }
      const key = need * 256 + held
      let tables = rolledTables.get(key)
      if (!tables) {
        tables = { floor: fold(floor[need], held), ceiling: fold(ceiling[need], held) }
        rolledTables.set(key, tables)
      }
      return tables
    },
    get bytes() {
      return size * 8 * 2 * (floor.length - 1 + rolledTables.size)
    },
  }
}

// The search that closes the gap between the two tables.
//
// The shop as entered is a board: the cards on show, and every way the sources
// could have made them, each with its chance. The first move is played on the
// board. From then on a situation is a belief, a spread of chances over table
// codes, in which cards of one kind are not told apart. A belief is opened only
// when the tables disagree about it by more than the tolerance.

import type { GoalModel } from './moves'
import { keepCounts, keptOptions, type Tables } from './tables'

/** Thrown when the deadline passes; the caller keeps the range it already has. */
export class OutOfTime extends Error {}

interface World {
  /** The source behind each card of the board. */
  origins: number[]
  chance: number
}

/** `items` holds each card's useful kind, or -1 for a card that only holds its source. */
export interface Board {
  items: number[]
  worlds: World[]
  key: string
}

type Belief = Map<number, number>

/** The chance of reaching the goal from a board, with `badges` in hand and `need` targets to go. */
export type Outlook = (board: Board, badges: number, need: number) => number

export interface Search {
  board: (items: number[], worlds: World[]) => Board
  project: (board: Board, cards: number[]) => Board
  afterRoll: (kept: Board, badges: number, need: number, next: Outlook) => number
  afterBuy: (board: Board, card: number, badges: number, need: number, next: Outlook) => number
  value: Outlook
  floor: Outlook
  ceiling: Outlook
  stats: { opened: number; deadline: number }
}

function permutations(values: number[]): number[][] {
  if (values.length < 2) return [values]
  return values.flatMap((value, i) =>
    permutations(values.filter((_, j) => j !== i)).map((rest) => [value, ...rest]),
  )
}

export function makeSearch(model: GoalModel, tables: Tables, tolerance = 1e-6): Search {
  const { kinds, sources, twins, reroll } = model
  const { ceiling, floor, rolledCeiling, affordable } = tables
  const { cards, shown, addOf } = tables.layout
  const stats = { opened: 0, deadline: Infinity }
  const opening = () => {
    if ((++stats.opened & 127) === 0 && performance.now() > stats.deadline) throw new OutOfTime()
  }

  // ---- Boards ----

  // Sources with the same odds for this goal are interchangeable, so each world
  // is renamed to use the first of its twins.
  const canon = (origins: number[]) => {
    const used = new Map<number[], number>()
    return origins.map((source) => {
      const group = twins[source]
      const taken = used.get(group) ?? 0
      used.set(group, taken + 1)
      return group[taken]
    })
  }

  const board = (items: number[], worlds: World[]): Board => {
    if (!items.length) return { items, worlds: [{ origins: [], chance: 1 }], key: '' }
    const merged = new Map<string, World>()
    let total = 0
    for (const world of worlds) {
      const origins = canon(world.origins)
      const key = origins.join('.')
      const known = merged.get(key)
      if (known) known.chance += world.chance
      else merged.set(key, { origins, chance: world.chance })
      total += world.chance
    }
    const list = [...merged].sort((a, b) => (a[0] < b[0] ? -1 : 1))
    for (const [, world] of list) world.chance /= total
    const text = list.map(([key, world]) => `${key}:${world.chance.toPrecision(12)}`).join(';')
    return { items, worlds: list.map(([, world]) => world), key: `${items.join(',')}|${text}` }
  }

  const project = (from: Board, chosen: number[]): Board =>
    board(
      chosen.map((i) => from.items[i]),
      from.worlds.map((world) => ({
        origins: chosen.map((i) => world.origins[i]),
        chance: world.chance,
      })),
    )

  const without = (from: Board, card: number) =>
    project(
      from,
      from.items.map((_, i) => i).filter((i) => i !== card),
    )

  /** The useful cards the badges can buy, sorted by kind. */
  const reachable = (from: Board, badges: number): Board => {
    const keep = from.items
      .map((kind, i) => (kind >= 0 && kinds[kind].good.price <= badges ? i : -1))
      .filter((i) => i >= 0)
      .sort((a, b) => from.items[a] - from.items[b] || a - b)
    if (keep.length === from.items.length && keep.every((card, i) => card === i)) return from
    return project(from, keep)
  }

  const codeOf = (items: number[], origins: number[]) => {
    let code = 0
    for (let i = 0; i < items.length; i++) code += addOf[origins[i]].get(items[i]) ?? 0
    return code
  }

  /** Whether cards of wanted heroes or pieces already on show are enough, and affordable. */
  const canFinish = (items: number[], badges: number, need: number) => {
    const cost = new Array<number>(need + 1).fill(Infinity)
    cost[0] = 0
    for (const item of items) {
      if (item < 0 || !kinds[item].certain) continue
      const { gain } = kinds[item].outcomes[0]
      for (let have = need - 1; have >= 0; have--) {
        const to = Math.min(need, have + gain)
        cost[to] = Math.min(cost[to], cost[have] + kinds[item].good.price)
      }
    }
    return cost[need] <= badges
  }

  const bound =
    (table: Float64Array[][]): Outlook =>
    (from, badges, need) => {
      if (need <= 0 || canFinish(from.items, badges, need)) return 1
      if (badges < 0) return 0
      const seen = reachable(from, badges)
      const row = table[need][badges]
      return seen.worlds.reduce((sum, w) => sum + w.chance * row[codeOf(seen.items, w.origins)], 0)
    }

  // ---- The first move, on the board ----

  const rolls = new Map<string, { chance: number; board: Board }[]>()
  /** Every shop a paid reroll that keeps `kept` can show, with `badges` left after the fee. */
  const roll = (kept: Board, badges: number) => {
    const key = `${badges}|${kept.key}`
    const known = rolls.get(key)
    if (known) return known
    const stay = kept.items
      .map((kind, i) => (kind >= 0 && kinds[kind].good.price <= badges ? i : -1))
      .filter((i) => i >= 0)
    const stayItems = stay.map((i) => kept.items[i])
    const seen = new Map<string, { chance: number; items: number[]; worlds: World[] }>()
    for (const world of kept.worlds) {
      const free = sources.flatMap((source, s) =>
        !world.origins.includes(s) && source.kinds.length ? [s] : [],
      )
      const base = stay.map((i) => world.origins[i])
      const fresh: [kind: number, source: number][] = []
      const emit = (index: number, chance: number) => {
        if (chance <= 0) return
        if (index < free.length) {
          const source = sources[free[index]]
          let none = source.none
          source.kinds.forEach((kind, j) => {
            if (kinds[kind].good.price > badges) {
              none += source.chances[j]
              return
            }
            fresh.push([kind, free[index]])
            emit(index + 1, chance * source.chances[j])
            fresh.pop()
          })
          emit(index + 1, chance * none)
          return
        }
        const ordered = [...fresh].sort((a, b) => a[0] - b[0])
        const look = ordered.map(([kind]) => kind).join(',')
        let entry = seen.get(look)
        if (!entry) {
          entry = { chance: 0, items: [...stayItems, ...ordered.map(([kind]) => kind)], worlds: [] }
          seen.set(look, entry)
        }
        entry.chance += chance
        // New cards of one kind arrive together, and which source made which is not known.
        let orders = [base]
        for (let i = 0; i < ordered.length;) {
          let end = i + 1
          while (end < ordered.length && ordered[end][0] === ordered[i][0]) end++
          const same = permutations(ordered.slice(i, end).map(([, source]) => source))
          orders = orders.flatMap((order) => same.map((more) => [...order, ...more]))
          i = end
        }
        for (const origins of orders) entry.worlds.push({ origins, chance: chance / orders.length })
      }
      emit(0, world.chance)
    }
    const merged = new Map<string, { chance: number; board: Board }>()
    for (const entry of seen.values()) {
      const next = board(entry.items, entry.worlds)
      const same = merged.get(next.key)
      if (same) same.chance += entry.chance
      else merged.set(next.key, { chance: entry.chance, board: next })
    }
    const result = [...merged.values()]
    rolls.set(key, result)
    return result
  }

  const afterRoll = (kept: Board, badges: number, need: number, next: Outlook) => {
    if (badges < 0) return 0
    let sum = 0
    for (const shop of roll(kept, badges)) sum += shop.chance * next(shop.board, badges, need)
    return Math.min(1, sum)
  }

  const afterBuy = (from: Board, card: number, badges: number, need: number, next: Outlook) => {
    const kind = kinds[from.items[card]]
    const left = badges - kind.good.price
    if (left < 0) return 0
    const rest = without(from, card)
    let sum = 0
    for (const outcome of kind.outcomes) {
      const togo = need - outcome.gain
      sum += outcome.chance * (togo <= 0 ? 1 : next(rest, left + outcome.refund, togo))
    }
    return Math.min(1, sum)
  }

  // ---- Later moves, on beliefs ----

  const known = new Map<string, number>()
  const freshMemo = new Map<number, [code: number, chance: number][]>()
  /** Every full shop the kept cards of `kept` can become, with its chance. */
  const fresh = (kept: number) => {
    let list = freshMemo.get(kept)
    if (list) return list
    list = [[kept, 1]]
    const taken = new Set(cards[kept].map((card) => card.source))
    sources.forEach((source, s) => {
      if (!source.kinds.length || taken.has(s)) return
      const next: [number, number][] = []
      for (const [code, chance] of list!) {
        // A source that always shows something useful leaves no shop without it.
        if (source.none > 0) next.push([code, chance * source.none])
        source.kinds.forEach((kind, k) =>
          next.push([code + addOf[s].get(kind)!, chance * source.chances[k]]),
        )
      }
      list = next
    })
    freshMemo.set(kept, list)
    return list
  }

  const tableAt = (table: Float64Array[][], need: number, badges: number, belief: Belief) => {
    if (need <= 0) return 1
    if (badges < 0) return 0
    const row = table[need][badges]
    let sum = 0
    for (const [code, chance] of belief) sum += chance * row[code]
    return sum
  }

  function beliefValue(need: number, badges: number, raw: Belief): number {
    if (need <= 0) return 1
    if (badges < 0) return 0
    const reach = affordable(badges)
    const belief: Belief = new Map()
    let total = 0
    for (const [code, chance] of raw) {
      belief.set(reach[code], (belief.get(reach[code]) ?? 0) + chance)
      total += chance
    }
    if (total !== 1) for (const [code, chance] of belief) belief.set(code, chance / total)
    const low = tableAt(floor, need, badges, belief)
    const high = tableAt(ceiling, need, badges, belief)
    if (high - low <= tolerance) return low
    const key = `${need}|${badges}|${[...belief]
      .sort((a, b) => a[0] - b[0])
      .map(([code, chance]) => `${code}:${chance.toPrecision(12)}`)
      .join(';')}`
    const answer = known.get(key)
    if (answer !== undefined) return answer
    opening()

    // Every code of a belief shows the same kinds.
    const first = belief.keys().next().value as number
    const present = [...new Set(cards[first].map((card) => card.kind))]
    const moves: { ceiling: number; run: () => number }[] = []

    for (const kind of present) {
      const { good, outcomes } = kinds[kind]
      const results = new Map<
        string,
        { need: number; badges: number; chance: number; belief: Belief }
      >()
      for (const [code, chance] of belief) {
        const same = cards[code].filter((card) => card.kind === kind)
        for (const card of same) {
          for (const outcome of outcomes) {
            const togo = need - outcome.gain
            const left = badges - good.price + outcome.refund
            const at = togo <= 0 ? 'done' : `${togo}|${left}`
            let result = results.get(at)
            if (!result) {
              result = { need: togo, badges: left, chance: 0, belief: new Map() }
              results.set(at, result)
            }
            const share = (chance * outcome.chance) / same.length
            const rest = code - card.add
            result.chance += share
            result.belief.set(rest, (result.belief.get(rest) ?? 0) + share)
          }
        }
      }
      let top = 0
      for (const result of results.values()) {
        if (result.need <= 0) {
          top += result.chance
          continue
        }
        const then = affordable(result.badges)
        const row = ceiling[result.need][result.badges]
        for (const [code, chance] of result.belief) top += chance * row[then[code]]
      }
      moves.push({
        ceiling: top,
        run: () => {
          let value = 0
          for (const result of results.values()) {
            value +=
              result.need <= 0
                ? result.chance
                : result.chance * beliefValue(result.need, result.badges, result.belief)
          }
          return value
        },
      })
    }

    const paid = badges - reroll
    if (paid >= 0) {
      const counts = present.map((kind) => cards[first].filter((c) => c.kind === kind).length)
      for (const keep of keepCounts(counts)) {
        const kept: Belief = new Map()
        for (const [code, chance] of belief) {
          const options = keptOptions(cards[code], code, present, keep)
          for (const option of options) {
            kept.set(option, (kept.get(option) ?? 0) + chance / options.length)
          }
        }
        moves.push({
          ceiling: tableAt(rolledCeiling, need, paid, kept),
          run: () => rolledValue(kept, paid, need),
        })
      }
    }

    moves.sort((a, b) => b.ceiling - a.ceiling)
    let best = low
    for (const move of moves) {
      if (move.ceiling <= best + 1e-12) break
      best = Math.max(best, move.run())
      if (best >= 1) break
    }
    best = Math.min(1, best)
    known.set(key, best)
    return best
  }

  function rolledValue(kept: Belief, badges: number, need: number): number {
    const reach = affordable(badges)
    const looks = new Map<string, { chance: number; belief: Belief }>()
    for (const [code, chance] of kept) {
      for (const [full, share] of fresh(code)) {
        const seen = reach[full]
        let look = looks.get(shown[seen])
        if (!look) {
          look = { chance: 0, belief: new Map() }
          looks.set(shown[seen], look)
        }
        look.chance += chance * share
        look.belief.set(seen, (look.belief.get(seen) ?? 0) + chance * share)
      }
    }
    let value = 0
    for (const look of looks.values()) value += look.chance * beliefValue(need, badges, look.belief)
    return value
  }

  const value: Outlook = (from, badges, need) => {
    if (need <= 0 || canFinish(from.items, badges, need)) return 1
    if (badges < 0) return 0
    const seen = reachable(from, badges)
    const belief: Belief = new Map()
    for (const world of seen.worlds) {
      const code = codeOf(seen.items, world.origins)
      belief.set(code, (belief.get(code) ?? 0) + world.chance)
    }
    return beliefValue(need, badges, belief)
  }

  return {
    board,
    project,
    afterRoll,
    afterBuy,
    value,
    floor: bound(floor),
    ceiling: bound(ceiling),
    stats,
  }
}

// The search that closes the gap between the two tables.
//
// The shop as entered is a board: the cards on show, and every way the sources
// could have made them, each with its chance. Only the first move is played on a
// board. Every shop after it is a belief: chances over the codes of one class,
// in which cards of one kind are not told apart. A belief is opened only when
// the tables disagree about it by more than the tolerance.

import type { GoalModel } from './moves'
import type { Tables } from './tables'

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
}

/**
 * Chances over the codes of the class `group`, in the order the class lists
 * them. They add up to the chance of the shop being one of these codes at all.
 */
interface Belief {
  group: number
  chances: Float64Array
}

/** The chance of reaching the goal from a belief, times the chance of the belief itself. */
type Reading = (need: number, badges: number, belief: Belief) => number

/** The chance of reaching the goal with `badges` in hand and `need` targets to go. */
export interface Outlook {
  from: (board: Board, badges: number, need: number) => number
  /** After a paid reroll that keeps the cards of `kept`, with `badges` left after the fee. */
  afterRoll: (kept: Board, badges: number, need: number) => number
  afterBuy: (board: Board, card: number, badges: number, need: number) => number
}

export interface Search {
  board: (items: number[], worlds: World[]) => Board
  project: (board: Board, cards: number[]) => Board
  /** The best chance, within the tolerance. */
  value: Outlook
  /** What the tables alone say. */
  floor: Outlook
  ceiling: Outlook
  stats: { opened: number; deadline: number }
  /** An estimate of the size in memory of the answers kept. */
  readonly bytes: number
}

// Chances are rounded to this step in an answer's key, so beliefs that differ
// only by rounding share an answer.
const KEY_STEPS = 2 ** 40
// What a kept answer takes besides its key's text.
const ANSWER_BYTES = 80

export function createSearch(model: GoalModel, tables: Tables, tolerance: number): Search {
  const { kinds, sources, twins, reroll } = model
  const { ceiling, floor, rolledCeiling, affordable } = tables
  const { size, place, cards, classes, classOf, slotOf, addOf } = tables.layout
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
    if (!items.length) return { items, worlds: [{ origins: [], chance: 1 }] }
    const merged = new Map<string, World>()
    let total = 0
    for (const world of worlds) {
      const origins = canon(world.origins)
      const key = origins.join()
      const known = merged.get(key)
      if (known) known.chance += world.chance
      else merged.set(key, { origins, chance: world.chance })
      total += world.chance
    }
    const list = [...merged.values()]
    for (const world of list) world.chance /= total
    return { items, worlds: list }
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

  // ---- Beliefs ----

  const blank = (group: number): Belief => ({
    group,
    chances: new Float64Array(classes[group].codes.length),
  })

  /** The code each world of a board makes of the useful cards the badges can buy. */
  const codesOf = (from: Board, badges: number) => {
    const counts = from.items.map((kind) => kind >= 0 && kinds[kind].good.price <= badges)
    return from.worlds.map((world) =>
      from.items.reduce(
        (code, kind, i) => (counts[i] ? code + (addOf[world.origins[i]].get(kind) ?? 0) : code),
        0,
      ),
    )
  }

  const view = (from: Board, badges: number): Belief => {
    const codes = codesOf(from, badges)
    const belief = blank(classOf[codes[0]])
    from.worlds.forEach((world, i) => (belief.chances[slotOf[codes[i]]] += world.chance))
    return belief
  }

  // Scratch for `deal`, all zero between calls: chances by code, and the codes that hold one.
  const spread = new Float64Array(size)
  const touched = new Int32Array(size)

  /**
   * Deals a new card from every free source onto the kept cards of `codes`, and
   * adds the shops that result to `looks`, one belief per class, with the cards
   * out of `reach` ignored. A source in `held` deals nothing, even for a code
   * that shows no card of it.
   */
  const deal = (
    looks: Map<number, Belief>,
    codes: ArrayLike<number>,
    chances: ArrayLike<number>,
    reach: Int32Array,
    held?: ReadonlySet<number>,
  ) => {
    let count = 0
    for (let j = 0; j < codes.length; j++) {
      if (!chances[j]) continue
      spread[codes[j]] = chances[j]
      touched[count++] = codes[j]
    }
    sources.forEach((source, s) => {
      if (!source.kinds.length || held?.has(s)) return
      const radix = source.kinds.length + 1
      const had = count
      for (let t = 0; t < had; t++) {
        const code = touched[t]
        if (Math.floor(code / place[s]) % radix) continue
        const chance = spread[code]
        for (let k = 0; k < source.chances.length; k++) {
          const share = source.chances[k] * chance
          if (!share) continue
          const to = code + (k + 1) * place[s]
          if (!spread[to]) touched[count++] = to
          spread[to] += share
        }
        spread[code] = source.none * chance
      }
    })
    for (let t = 0; t < count; t++) {
      const chance = spread[touched[t]]
      spread[touched[t]] = 0
      if (!chance) continue
      const seen = reach[touched[t]]
      let look = looks.get(classOf[seen])
      if (!look) {
        look = blank(classOf[seen])
        looks.set(look.group, look)
      }
      look.chances[slotOf[seen]] += chance
    }
  }

  // A row holds a value for every code, so cards out of reach need no care here.
  const tableAt = (table: Float64Array[][], need: number, badges: number, belief: Belief) => {
    const row = table[need][badges]
    const { codes } = classes[belief.group]
    let sum = 0
    for (let j = 0; j < codes.length; j++) sum += belief.chances[j] * row[codes[j]]
    return sum
  }

  const floorAt: Reading = (need, badges, belief) => tableAt(floor, need, badges, belief)
  const ceilingAt: Reading = (need, badges, belief) => tableAt(ceiling, need, badges, belief)

  // ---- The search, on beliefs ----

  const known = new Map<string, number>()
  let knownBytes = 0

  // An answer's key is the bytes of these numbers, read as text.
  const largest = classes.reduce((most, group) => Math.max(most, group.codes.length), 0)
  const keyNumbers = new Float64Array(3 + largest)
  const keyText = new Uint16Array(keyNumbers.buffer)
  const keyOf = (need: number, badges: number, belief: Belief): string => {
    const { chances } = belief
    keyNumbers[0] = need
    keyNumbers[1] = badges
    keyNumbers[2] = belief.group
    for (let j = 0; j < chances.length; j++) keyNumbers[3 + j] = Math.round(chances[j] * KEY_STEPS)
    return Reflect.apply(String.fromCharCode, null, keyText.subarray(0, 4 * (3 + chances.length)))
  }

  function searched(need: number, badges: number, raw: Belief): number {
    const from = classes[raw.group].codes
    const floorRow = floor[need][badges]
    const ceilingRow = ceiling[need][badges]
    let total = 0
    let low = 0
    let high = 0
    for (let j = 0; j < from.length; j++) {
      const chance = raw.chances[j]
      total += chance
      low += chance * floorRow[from[j]]
      high += chance * ceilingRow[from[j]]
    }
    if (high - low <= tolerance * total) return low

    // Cards the badges cannot buy are ignored, and the chances scaled to add up
    // to 1, so that every belief with the same answer has the same key.
    const reach = affordable(badges)
    const belief = blank(classOf[reach[from[0]]])
    for (let j = 0; j < from.length; j++) {
      belief.chances[slotOf[reach[from[j]]]] += raw.chances[j] / total
    }
    const key = keyOf(need, badges, belief)
    let best = known.get(key)
    if (best === undefined) {
      opening()
      best = open(need, badges, belief, low / total)
      known.set(key, best)
      knownBytes += 2 * key.length + ANSWER_BYTES
    }
    return total * best
  }

  /** The best chance from a belief whose chances add up to 1, the tables' floor being `low`. */
  function open(need: number, badges: number, belief: Belief, low: number): number {
    const { codes, present, sameKind, keeps, kept, keptFrom } = classes[belief.group]
    const { chances } = belief
    const moves: { ceiling: number; run: () => number }[] = []

    present.forEach((kind, i) => {
      const { good, outcomes } = kinds[kind]
      // The cards of one kind look the same, so the one bought is any of them.
      const rest = blank(classOf[codes[0] - sameKind[i][0][0].add])
      for (let j = 0; j < codes.length; j++) {
        if (!chances[j]) continue
        const same = sameKind[i][j]
        for (const card of same) {
          rest.chances[slotOf[codes[j] - card.add]] += chances[j] / same.length
        }
      }
      const left = badges - good.price
      const bought = (then: Reading) => {
        let sum = 0
        for (const outcome of outcomes) {
          const togo = need - outcome.gain
          sum += outcome.chance * (togo <= 0 ? 1 : then(togo, left + outcome.refund, rest))
        }
        return sum
      }
      moves.push({ ceiling: bought(ceilingAt), run: () => bought(searched) })
    })

    const paid = badges - reroll
    if (paid >= 0) {
      for (let way = 0; way < keeps; way++) {
        const held = blank(classOf[kept[keptFrom[way]]])
        for (let j = 0; j < codes.length; j++) {
          if (!chances[j]) continue
          const from = keptFrom[j * keeps + way]
          const to = keptFrom[j * keeps + way + 1]
          for (let i = from; i < to; i++) held.chances[slotOf[kept[i]]] += chances[j] / (to - from)
        }
        moves.push({
          ceiling: tableAt(rolledCeiling, need, paid, held),
          run: () => rolled(need, paid, held),
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
    return Math.min(1, best)
  }

  /** The best chance once every free source has dealt a new card onto the kept ones. */
  function rolled(need: number, badges: number, held: Belief): number {
    const looks = new Map<number, Belief>()
    deal(looks, classes[held.group].codes, held.chances, affordable(badges))
    let sum = 0
    for (const look of looks.values()) sum += searched(need, badges, look)
    return sum
  }

  // ---- The first move, on the board ----

  /** Whether cards of wanted heroes or pieces already on show are enough, and affordable. */
  const canFinish = (group: number, badges: number, need: number) => {
    const cost = new Array<number>(need + 1).fill(Infinity)
    cost[0] = 0
    for (const { kind } of cards[classes[group].codes[0]]) {
      if (!kinds[kind].certain) continue
      const { gain } = kinds[kind].outcomes[0]
      for (let have = need - 1; have >= 0; have--) {
        const to = Math.min(need, have + gain)
        cost[to] = Math.min(cost[to], cost[have] + kinds[kind].good.price)
      }
    }
    return cost[need] <= badges
  }

  const outlook = (read: Reading): Outlook => {
    const seen = (belief: Belief, badges: number, need: number) =>
      canFinish(belief.group, badges, need)
        ? belief.chances.reduce((sum, chance) => sum + chance, 0)
        : read(need, badges, belief)

    const from = (start: Board, badges: number, need: number) => {
      if (need <= 0) return 1
      if (badges < 0) return 0
      return seen(view(start, badges), badges, need)
    }

    return {
      from,
      afterRoll: (kept, badges, need) => {
        if (badges < 0) return 0
        const reach = affordable(badges)
        const codes = codesOf(kept, badges)
        const looks = new Map<number, Belief>()
        // Every kept card holds its source, whether or not it counts toward the goal.
        kept.worlds.forEach((world, i) =>
          deal(looks, [codes[i]], [world.chance], reach, new Set(world.origins)),
        )
        let sum = 0
        for (const look of looks.values()) sum += seen(look, badges, need)
        return Math.min(1, sum)
      },
      afterBuy: (start, card, badges, need) => {
        const kind = kinds[start.items[card]]
        const left = badges - kind.good.price
        if (left < 0) return 0
        const rest = without(start, card)
        let sum = 0
        for (const outcome of kind.outcomes) {
          sum += outcome.chance * from(rest, left + outcome.refund, need - outcome.gain)
        }
        return Math.min(1, sum)
      },
    }
  }

  return {
    board,
    project,
    value: outlook(searched),
    floor: outlook(floorAt),
    ceiling: outlook(ceilingAt),
    stats,
    get bytes() {
      return knownBytes
    },
  }
}

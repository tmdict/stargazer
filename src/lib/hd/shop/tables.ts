// Two tables that bracket the best chance of reaching a goal from any later shop.
//
// A later shop is written as a code: one digit per source, 0 when the source
// shows nothing useful, else which of its useful kinds it shows. The player sees
// the kinds on show but not which source made each card, and that matters,
// because a locked card keeps its source from making a new one.
//
// The ceiling table answers for a player who is told the sources, so it is never
// too low. The floor table answers for a player who must choose one move for
// every code that looks the same, and who forgets what earlier shops showed, so
// it is never too high. The search in `search.ts` works only where they differ.

import type { GoalModel } from './moves'

/** One useful card of a code. `add` is what the card contributes to the code. */
export interface ShownCard {
  source: number
  kind: number
  add: number
}

/** The codes that show the same kinds, and the rerolls a player can tell apart there. */
interface CodeClass {
  codes: number[]
  /** The kinds on show. */
  present: number[]
  /** For each kind on show, for each code, that code's cards of the kind. */
  sameKind: ShownCard[][][]
  /**
   * For each code, for each count of cards kept per kind: every code the kept
   * cards can form, each as likely as the next.
   */
  keptCodes: Int32Array[][]
}

export interface Layout {
  size: number
  cards: ShownCard[][]
  /** The chance a fresh shop shows exactly this code. */
  weight: Float64Array
  /** The kinds a code shows, sorted, as text: codes with equal text look the same. */
  shown: string[]
  /** For each code, every code a choice of locks can leave. */
  lockSets: Int32Array[]
  classes: CodeClass[]
  /** For each source, what a card of each kind adds to a code. */
  addOf: Map<number, number>[]
  /** Turns values of full shops into values of kept cards: each free source shows a new card. */
  fold: (values: Float64Array) => Float64Array
}

/** Every way to keep `keep[i]` cards of kind `kinds[i]` from a code. */
export function keptOptions(
  cards: readonly ShownCard[],
  code: number,
  kinds: readonly number[],
  keep: readonly number[],
): number[] {
  let options = [code]
  kinds.forEach((kind, i) => {
    const mine = cards.filter((card) => card.kind === kind)
    const next: number[] = []
    const drop = (from: number, left: number, value: number) => {
      if (!left) {
        next.push(value)
        return
      }
      for (let j = from; j <= mine.length - left; j++) drop(j + 1, left - 1, value - mine[j].add)
    }
    for (const option of options) drop(0, mine.length - keep[i], option)
    options = next
  })
  return options
}

/** Every count of cards kept per kind, given how many of each are on show. */
export function keepCounts(counts: readonly number[]): number[][] {
  let keeps: number[][] = [[]]
  for (const count of counts) {
    keeps = keeps.flatMap((keep) => Array.from({ length: count + 1 }, (_, j) => [...keep, j]))
  }
  return keeps
}

export function layout(model: GoalModel): Layout {
  const { sources } = model
  const radix = sources.map((source) => source.kinds.length + 1)
  const mult: number[] = []
  let size = 1
  for (const r of radix) {
    mult.push(size)
    size *= r
  }

  const cards: ShownCard[][] = []
  const weight = new Float64Array(size)
  const shown: string[] = []
  for (let code = 0; code < size; code++) {
    const list: ShownCard[] = []
    let chance = 1
    sources.forEach((source, i) => {
      const digit = Math.floor(code / mult[i]) % radix[i]
      if (digit) {
        list.push({ source: i, kind: source.kinds[digit - 1], add: digit * mult[i] })
        chance *= source.chances[digit - 1]
      } else {
        chance *= source.none
      }
    })
    cards.push(list)
    weight[code] = chance
    shown.push(
      list
        .map((card) => card.kind)
        .sort((a, b) => a - b)
        .join(','),
    )
  }

  const lockSets = cards.map((list, code) => {
    const none = list.reduce((value, card) => value - card.add, code)
    const sets = new Int32Array(1 << list.length)
    for (let mask = 0; mask < sets.length; mask++) {
      let value = none
      for (let i = 0; i < list.length; i++) if ((mask >> i) & 1) value += list[i].add
      sets[mask] = value
    }
    return sets
  })

  const alike = new Map<string, number[]>()
  shown.forEach((text, code) => alike.set(text, [...(alike.get(text) ?? []), code]))
  const classes = [...alike.values()].map((codes): CodeClass => {
    const list = cards[codes[0]]
    const present = [...new Set(list.map((card) => card.kind))]
    const keeps = keepCounts(present.map((kind) => list.filter((c) => c.kind === kind).length))
    return {
      codes,
      present,
      sameKind: present.map((kind) =>
        codes.map((code) => cards[code].filter((card) => card.kind === kind)),
      ),
      keptCodes: codes.map((code) =>
        keeps.map((keep) => Int32Array.from(keptOptions(cards[code], code, present, keep))),
      ),
    }
  })

  const fold = (values: Float64Array): Float64Array => {
    const folded = Float64Array.from(values)
    sources.forEach((source, i) => {
      if (!source.kinds.length) return
      for (let code = 0; code < size; code++) {
        if (Math.floor(code / mult[i]) % radix[i]) continue
        let sum = source.none * folded[code]
        for (let k = 0; k < source.chances.length; k++) {
          sum += source.chances[k] * folded[code + (k + 1) * mult[i]]
        }
        folded[code] = sum
      }
    })
    return folded
  }

  const addOf = sources.map(
    (source, i) => new Map(source.kinds.map((kind, j) => [kind, (j + 1) * mult[i]])),
  )
  return { size, cards, weight, shown, lockSets, classes, addOf, fold }
}

/** Tables indexed `[targets still needed][badges]`, each row one value per code. */
export interface Tables {
  layout: Layout
  maxBadges: number
  ceiling: Float64Array[][]
  floor: Float64Array[][]
  /** The same two tables for the cards kept through a reroll, before the new cards show. */
  rolledCeiling: Float64Array[][]
  rolledFloor: Float64Array[][]
  /** For each code, the code left once cards the badges cannot buy are ignored. */
  affordable: (badges: number) => Int32Array
  bytes: number
}

// A chance this close to 1 is treated as certain.
const SURE = 1e-9

export function buildTables(model: GoalModel, maxBadges: number): Tables {
  const { kinds, need, reroll } = model
  const shape = layout(model)
  const { size, cards, weight, lockSets, classes, fold } = shape

  // Badges only go down, so a card too dear now stays too dear: it is ignored,
  // and the codes that differ only in such cards share one answer.
  const prices = [...new Set(kinds.map((kind) => kind.good.price))].sort((a, b) => a - b)
  const withinReach = [-1, ...prices].map((limit) =>
    Int32Array.from(cards, (list, code) =>
      list.reduce(
        (value, card) => (kinds[card.kind].good.price > limit ? value - card.add : value),
        code,
      ),
    ),
  )
  const affordable = (badges: number) => {
    let band = 0
    while (band < prices.length && prices[band] <= badges) band++
    return withinReach[band]
  }

  const rows = () => Array.from({ length: need + 1 }, () => new Array<Float64Array>(maxBadges + 1))
  const ceiling = rows()
  const floor = rows()
  const rolledCeiling = rows()
  const rolledFloor = rows()

  const at = (table: Float64Array[][], n: number, badges: number, code: number) =>
    n <= 0 ? 1 : badges < 0 ? 0 : table[n][badges][code]
  const buy = (
    table: Float64Array[][],
    n: number,
    badges: number,
    code: number,
    card: ShownCard,
  ) => {
    const kind = kinds[card.kind]
    const left = badges - kind.good.price
    let sum = 0
    for (const outcome of kind.outcomes) {
      sum += outcome.chance * at(table, n - outcome.gain, left + outcome.refund, code - card.add)
    }
    return sum
  }

  // Per price band, the codes of each class that are their own answer.
  const liveByBand = new Map<Int32Array, { group: CodeClass; live: number[] }[]>()
  const liveClasses = (reach: Int32Array) => {
    let list = liveByBand.get(reach)
    if (!list) {
      list = classes
        .map((group) => ({
          group,
          live: group.codes.flatMap((code, slot) => (reach[code] === code ? [slot] : [])),
        }))
        .filter(({ live }) => live.length)
      liveByBand.set(reach, list)
    }
    return list
  }

  const certain = new Float64Array(size).fill(1)
  const sure: ({ floor: Float64Array; rolledFloor: Float64Array } | undefined)[] = []
  let rowsFilled = 0

  for (let badges = 0; badges <= maxBadges; badges++) {
    const reach = affordable(badges)
    for (let n = 1; n <= need; n++) {
      // Once the goal is as good as certain from every shop, more badges change
      // nothing: the player can play as if holding the fewer badges, so that
      // row stays a floor for every count above it, and the ceiling is 1.
      const settled = sure[n]
      if (settled) {
        ceiling[n][badges] = rolledCeiling[n][badges] = certain
        floor[n][badges] = settled.floor
        rolledFloor[n][badges] = settled.rolledFloor
        continue
      }
      rowsFilled++
      const high = new Float64Array(size)
      const low = new Float64Array(size)
      const paid = badges - reroll
      const rolledHigh = paid >= 0 ? rolledCeiling[n][paid] : null
      const rolledLow = paid >= 0 ? rolledFloor[n][paid] : null

      for (let code = 0; code < size; code++) {
        if (reach[code] !== code) continue
        let best = 0
        for (const card of cards[code]) best = Math.max(best, buy(ceiling, n, badges, code, card))
        if (rolledHigh) {
          const sets = lockSets[code]
          for (let i = 0; i < sets.length; i++) best = Math.max(best, rolledHigh[sets[i]])
        }
        high[code] = Math.min(1, best)
      }

      for (const { group, live } of liveClasses(reach)) {
        const { codes, sameKind, keptCodes } = group
        let bestScore = -1
        let tried = new Float64Array(live.length)
        let best = new Float64Array(live.length)
        const consider = () => {
          let score = 0
          for (let j = 0; j < live.length; j++) score += weight[codes[live[j]]] * tried[j]
          if (score > bestScore + 1e-15) {
            bestScore = score
            const spare = best
            best = tried
            tried = spare
          }
        }
        for (const same of sameKind) {
          for (let j = 0; j < live.length; j++) {
            const mine = same[live[j]]
            let sum = 0
            for (const card of mine) sum += buy(floor, n, badges, codes[live[j]], card)
            tried[j] = sum / mine.length
          }
          consider()
        }
        if (rolledLow) {
          const keeps = keptCodes[0].length
          for (let keep = 0; keep < keeps; keep++) {
            for (let j = 0; j < live.length; j++) {
              const options = keptCodes[live[j]][keep]
              let sum = 0
              for (let i = 0; i < options.length; i++) sum += rolledLow[options[i]]
              tried[j] = sum / options.length
            }
            consider()
          }
        }
        if (bestScore >= 0) {
          for (let j = 0; j < live.length; j++) low[codes[live[j]]] = Math.min(1, best[j])
        }
      }

      for (let code = 0; code < size; code++) {
        if (reach[code] === code) continue
        high[code] = high[reach[code]]
        low[code] = low[reach[code]]
      }
      ceiling[n][badges] = high
      floor[n][badges] = low
      rolledCeiling[n][badges] = fold(high)
      rolledFloor[n][badges] = fold(low)
      if (low.every((value) => value >= 1 - SURE)) {
        sure[n] = { floor: low, rolledFloor: rolledFloor[n][badges] }
      }
    }
  }

  return {
    layout: shape,
    maxBadges,
    ceiling,
    floor,
    rolledCeiling,
    rolledFloor,
    affordable,
    bytes: size * 8 * 4 * rowsFilled,
  }
}

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

// ---- The codes ----

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
  /** How many ways there are to keep some count of the cards of each kind on show. */
  keeps: number
  /**
   * For each code and each such way, every code the kept cards can form, each as
   * likely as the next: the entries of `kept` from `keptFrom[slot * keeps + way]`
   * up to the next entry of `keptFrom`.
   */
  kept: Int32Array
  keptFrom: Int32Array
}

export interface Layout {
  size: number
  /** For each source, what one step of its digit adds to a code. */
  place: number[]
  cards: ShownCard[][]
  /** The chance a fresh shop shows exactly this code. */
  weight: Float64Array
  /** For each code, its class in `classes` and its place among that class's codes. */
  classOf: Int32Array
  slotOf: Int32Array
  /** For each code, every code a choice of locks can leave. */
  lockSets: Int32Array[]
  classes: CodeClass[]
  /** For each source, what a card of each kind adds to a code. */
  addOf: Map<number, number>[]
  /**
   * Turns values of full shops into values of kept cards: each free source shows
   * a new card. A source in the bit mask `held` sits behind a kept card that
   * cannot help, and shows nothing new.
   */
  fold: (values: Float64Array, held?: number) => Float64Array
  /** An estimate of its size in memory. */
  bytes: number
}

/** Every way to keep `keep[i]` cards of kind `kinds[i]` from a code. */
function keptOptions(
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
function keepCounts(counts: readonly number[]): number[][] {
  let keeps: number[][] = [[]]
  for (const count of counts) {
    keeps = keeps.flatMap((keep) => Array.from({ length: count + 1 }, (_, j) => [...keep, j]))
  }
  return keeps
}

function layout(model: GoalModel): Layout {
  const { sources } = model
  const radix = sources.map((source) => source.kinds.length + 1)
  const place: number[] = []
  let size = 1
  for (const r of radix) {
    place.push(size)
    size *= r
  }

  const cards: ShownCard[][] = []
  const weight = new Float64Array(size)
  // The kinds a code shows, sorted, as text: codes with equal text look the same.
  const alike = new Map<string, number[]>()
  for (let code = 0; code < size; code++) {
    const list: ShownCard[] = []
    let chance = 1
    sources.forEach((source, i) => {
      const digit = Math.floor(code / place[i]) % radix[i]
      if (digit) {
        list.push({ source: i, kind: source.kinds[digit - 1], add: digit * place[i] })
        chance *= source.chances[digit - 1]
      } else {
        chance *= source.none
      }
    })
    cards.push(list)
    weight[code] = chance
    const shown = list
      .map((card) => card.kind)
      .sort((a, b) => a - b)
      .join(',')
    const same = alike.get(shown)
    if (same) same.push(code)
    else alike.set(shown, [code])
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

  const classOf = new Int32Array(size)
  const slotOf = new Int32Array(size)
  const classes = [...alike.values()].map((codes, group): CodeClass => {
    codes.forEach((code, slot) => {
      classOf[code] = group
      slotOf[code] = slot
    })
    const list = cards[codes[0]]
    const present = [...new Set(list.map((card) => card.kind))]
    const ways = keepCounts(present.map((kind) => list.filter((c) => c.kind === kind).length))
    const kept: number[] = []
    const keptFrom: number[] = []
    for (const code of codes) {
      for (const keep of ways) {
        keptFrom.push(kept.length)
        for (const option of keptOptions(cards[code], code, present, keep)) kept.push(option)
      }
    }
    keptFrom.push(kept.length)
    return {
      codes,
      present,
      sameKind: present.map((kind) =>
        codes.map((code) => cards[code].filter((card) => card.kind === kind)),
      ),
      keeps: ways.length,
      kept: Int32Array.from(kept),
      keptFrom: Int32Array.from(keptFrom),
    }
  })

  // For each source that can show something useful, the codes in which it does not.
  const bare = sources.map((source, i) =>
    Int32Array.from(
      source.kinds.length
        ? cards.flatMap((list, code) => (list.some((card) => card.source === i) ? [] : [code]))
        : [],
    ),
  )

  const fold = (values: Float64Array, held = 0): Float64Array => {
    const folded = Float64Array.from(values)
    sources.forEach(({ kinds, chances, none }, i) => {
      if (!kinds.length || (held >> i) & 1) return
      const codes = bare[i]
      const step = place[i]
      for (let j = 0; j < codes.length; j++) {
        const code = codes[j]
        let sum = none * folded[code]
        for (let k = 0; k < chances.length; k++) sum += chances[k] * folded[code + (k + 1) * step]
        folded[code] = sum
      }
    })
    return folded
  }

  const addOf = sources.map(
    (source, i) => new Map(source.kinds.map((kind, j) => [kind, (j + 1) * place[i]])),
  )

  // Four bytes a number in the typed arrays. The rest, the cards and the small
  // arrays around each code, at what it was measured to take in V8.
  const shownCards = cards.reduce((sum, list) => sum + list.length, 0)
  const numbers =
    2 * size +
    bare.reduce((sum, codes) => sum + codes.length, 0) +
    lockSets.reduce((sum, sets) => sum + sets.length, 0) +
    classes.reduce((sum, group) => sum + group.kept.length + group.keptFrom.length, 0)
  const bytes = 4 * numbers + 140 * shownCards + 680 * size

  return { size, place, cards, weight, classOf, slotOf, lockSets, classes, addOf, fold, bytes }
}

// ---- The tables ----

/**
 * Tables indexed `[targets still needed][badges]`, each row one value per code.
 * They start empty and hold the rows `cover` has filled. A row depends only on
 * rows for fewer badges and no more targets, so rows filled for one request stay
 * good for every later one.
 */
export interface Tables {
  layout: Layout
  ceiling: Float64Array[][]
  floor: Float64Array[][]
  /** The same two tables for the cards kept through a reroll, before the new cards show. */
  rolledCeiling: Float64Array[][]
  rolledFloor: Float64Array[][]
  /** For each code, the code left once cards the badges cannot buy are ignored. */
  affordable: (badges: number) => Int32Array
  /** Fills the rows still missing for up to `need` targets and `badges` badges. */
  cover: (need: number, badges: number) => void
  /** An estimate of the size in memory of the layout and the filled rows. */
  readonly bytes: number
}

// A chance this close to 1 is treated as certain.
const SURE = 1e-9

/** Empty tables for a model. */
export function createTables(model: GoalModel): Tables {
  const { kinds, reroll } = model
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

  // Row 0 of each table stays empty: with no target left the chance is 1.
  const ceiling: Float64Array[][] = [[]]
  const floor: Float64Array[][] = [[]]
  const rolledCeiling: Float64Array[][] = [[]]
  const rolledFloor: Float64Array[][] = [[]]

  const certain = new Float64Array(size).fill(1)
  const hopeless = new Float64Array(size)

  // For each kind, the row each result of buying it reads, with `n` targets
  // needed and `badges` in hand.
  const rowsAfter = (table: Float64Array[][], n: number, badges: number) =>
    kinds.map(({ good, outcomes }) => {
      const left = badges - good.price
      return outcomes.map((outcome) => {
        if (n - outcome.gain <= 0) return certain
        return left + outcome.refund < 0 ? hopeless : table[n - outcome.gain][left + outcome.refund]
      })
    })
  const buy = (rows: Float64Array[][], card: ShownCard, code: number) => {
    const { outcomes } = kinds[card.kind]
    const read = rows[card.kind]
    const rest = code - card.add
    let sum = 0
    for (let i = 0; i < outcomes.length; i++) sum += outcomes[i].chance * read[i][rest]
    return sum
  }

  // Per price band, the codes of each class that are their own answer, with
  // the chance a fresh shop shows each.
  interface LiveClass {
    group: CodeClass
    live: number[]
    weights: Float64Array
  }
  const liveByBand = new Map<Int32Array, LiveClass[]>()
  const liveClasses = (reach: Int32Array) => {
    let list = liveByBand.get(reach)
    if (!list) {
      list = classes
        .map((group) => {
          const live = group.codes.flatMap((code, slot) => (reach[code] === code ? [slot] : []))
          // Codes with no chance of showing in a fresh shop hold cards carried
          // in from another level. Where a class has only those they count
          // alike, or every plan would score the same and the first be kept.
          const weights = Float64Array.from(live, (slot) => weight[group.codes[slot]])
          return {
            group,
            live,
            weights: weights.some((value) => value > 0) ? weights : weights.fill(1),
          }
        })
        .filter(({ live }) => live.length)
      liveByBand.set(reach, list)
    }
    return list
  }

  // Scratch for the floor's plans, one value per code of a class.
  const widest = classes.reduce((most, group) => Math.max(most, group.codes.length), 0)
  const plans = [new Float64Array(widest), new Float64Array(widest)]

  const sure: ({ floor: Float64Array; rolledFloor: Float64Array } | undefined)[] = []
  let rowsFilled = 0

  const fill = (n: number, badges: number) => {
    // Once the goal is as good as certain from every shop, more badges change
    // nothing: the player can play as if holding the fewer badges, so that
    // row stays a floor for every count above it, and the ceiling is 1.
    const settled = sure[n]
    if (settled) {
      ceiling[n][badges] = rolledCeiling[n][badges] = certain
      floor[n][badges] = settled.floor
      rolledFloor[n][badges] = settled.rolledFloor
      return
    }
    rowsFilled++
    const reach = affordable(badges)
    const high = new Float64Array(size)
    const low = new Float64Array(size)
    const paid = badges - reroll
    const rolledHigh = paid >= 0 ? rolledCeiling[n][paid] : null
    const rolledLow = paid >= 0 ? rolledFloor[n][paid] : null
    const highRows = rowsAfter(ceiling, n, badges)
    const lowRows = rowsAfter(floor, n, badges)

    for (let code = 0; code < size; code++) {
      if (reach[code] !== code) continue
      let best = 0
      for (const card of cards[code]) best = Math.max(best, buy(highRows, card, code))
      if (rolledHigh) {
        const sets = lockSets[code]
        for (let i = 0; i < sets.length; i++) best = Math.max(best, rolledHigh[sets[i]])
      }
      high[code] = Math.min(1, best)
    }

    for (const { group, live, weights } of liveClasses(reach)) {
      const { codes, sameKind, keeps, kept, keptFrom } = group
      let bestScore = -1
      let [tried, best] = plans
      const consider = () => {
        let score = 0
        for (let j = 0; j < live.length; j++) score += weights[j] * tried[j]
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
          for (const card of mine) sum += buy(lowRows, card, codes[live[j]])
          tried[j] = sum / mine.length
        }
        consider()
      }
      if (rolledLow) {
        for (let way = 0; way < keeps; way++) {
          for (let j = 0; j < live.length; j++) {
            const from = keptFrom[live[j] * keeps + way]
            const to = keptFrom[live[j] * keeps + way + 1]
            let sum = 0
            for (let i = from; i < to; i++) sum += rolledLow[kept[i]]
            tried[j] = sum / (to - from)
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

  // A row reads rows of the same or fewer targets and fewer badges, so targets
  // go in rising order, each to the full badge count, before the next.
  const cover = (need: number, badges: number) => {
    for (let n = 1; n <= need; n++) {
      if (n === ceiling.length) {
        for (const table of [ceiling, floor, rolledCeiling, rolledFloor]) table.push([])
      }
      for (let next = ceiling[n].length; next <= badges; next++) fill(n, next)
    }
  }

  return {
    layout: shape,
    ceiling,
    floor,
    rolledCeiling,
    rolledFloor,
    affordable,
    cover,
    get bytes() {
      return shape.bytes + size * 8 * 4 * rowsFilled
    },
  }
}

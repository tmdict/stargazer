import { PlacementBoard } from './board'
import { PlacementScorer, type PlacementScore } from './score'
import type { PlacementData, PlacementLookups, PlacementTeam } from './types'

// Scores closer than this are equal, so sums of the same weights in another
// order compare equal.
const EPS = 1e-9
// The local search climbs from this many placements drawn at random. A goal
// that three units must move together to meet, such as two heroes of one
// faction between the twins, is reached only from a start near it, and 16
// starts miss it for about one Season 8 team in ten that could meet it.
const STARTS = 32
const EQUAL_CAP = 1000

interface PlacementOptions {
  // Score every placement instead of searching from a few.
  full?: boolean
  // Units kept on these tiles, by unit id: only the team's other units move. A
  // unit not in the team leaves its tile free.
  held?: ReadonlyMap<number, number>
}

export interface PlacementResult {
  // The team's units, heroes first, and the tile each stands on in the pick.
  units: number[]
  positions: number[]
  // The best score found, which the pick is within the margin of.
  best: PlacementScore
  // Placements with the pick's broken rules and goals within the margin of the
  // best, and whether the count reached them all rather than stopping at its cap.
  equallyGood: number
  complete: boolean
  // For each hero, in the team's order, the tiles it stands on among them.
  kept: number[][]
}

// Negative when `a` is the better score: fewer broken rules, then higher goals,
// then a higher total.
function compare(a: PlacementScore, b: PlacementScore): number {
  if (a.broken !== b.broken) return a.broken - b.broken
  if (Math.abs(a.goals - b.goals) > EPS) return b.goals - a.goals
  if (Math.abs(a.total - b.total) > EPS) return b.total - a.total
  return 0
}

// Whether a placement counts as good as the best: the same always rules broken,
// and goals within the margin.
export const asGoodAs = (score: PlacementScore, best: PlacementScore, margin: number): boolean =>
  score.broken === best.broken && score.goals >= best.goals - margin - EPS

// A generator of numbers in [0, 1) seeded from a string, so one team on one map
// always searches from the same starts.
function seeded(text: string): () => number {
  let seed = 2166136261
  for (let i = 0; i < text.length; i++) seed = Math.imul(seed ^ text.charCodeAt(i), 16777619)
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), seed | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const keyOf = (positions: readonly number[]): string => positions.join(',')
const positionsOf = (key: string): number[] => key.split(',').map(Number)

class Search {
  readonly scores = new Map<string, PlacementScore>()

  constructor(
    private readonly board: PlacementBoard,
    private readonly scorer: PlacementScorer,
    // The indices of the units a step may move.
    private readonly movable: readonly number[],
  ) {}

  evaluate(positions: readonly number[]): PlacementScore {
    const key = keyOf(positions)
    let score = this.scores.get(key)
    if (!score) {
      this.board.place(positions)
      score = this.scorer.score()
      this.scores.set(key, score)
    }
    return score
  }

  // Every placement one step away: a unit moved to a free tile, or two units
  // trading tiles.
  *neighbours(positions: readonly number[]): Generator<number[]> {
    const used = new Set(positions)
    const free = this.board.tiles.filter((hexId) => !used.has(hexId))
    const movable = this.movable
    for (let p = 0; p < movable.length; p++) {
      const i = movable[p]!
      for (const hexId of free) {
        const next = [...positions]
        next[i] = hexId
        yield next
      }
      for (let q = p + 1; q < movable.length; q++) {
        const j = movable[q]!
        const next = [...positions]
        next[i] = positions[j]!
        next[j] = positions[i]!
        yield next
      }
    }
  }

  // Every placement where two units move together, each to a free tile or to
  // the other's tile.
  *pairs(positions: readonly number[]): Generator<number[]> {
    const used = new Set(positions)
    const free = this.board.tiles.filter((hexId) => !used.has(hexId))
    const movable = this.movable
    for (let p = 0; p < movable.length; p++) {
      const i = movable[p]!
      for (let q = p + 1; q < movable.length; q++) {
        const j = movable[q]!
        const options = [...free, positions[i]!, positions[j]!]
        for (const a of options) {
          for (const b of options) {
            if (a === b) continue
            const next = [...positions]
            next[i] = a
            next[j] = b
            yield next
          }
        }
      }
    }
  }

  // Takes the best step until none improves, then the best move of two units
  // together, since some goals need two units to move at once.
  climb(start: number[]): void {
    let current = start
    let score = this.evaluate(current)
    for (;;) {
      let step: number[] | undefined
      for (const next of this.neighbours(current)) {
        const nextScore = this.evaluate(next)
        if (compare(nextScore, score) < 0) {
          step = next
          score = nextScore
        }
      }
      if (!step) {
        for (const next of this.pairs(current)) {
          const nextScore = this.evaluate(next)
          if (compare(nextScore, score) < 0) {
            step = next
            score = nextScore
          }
        }
      }
      if (!step) return
      current = step
    }
  }

  // The best placement scored, the first scored on a tie.
  bestKey(): string {
    let best: [string, PlacementScore] | undefined
    for (const entry of this.scores) if (!best || compare(entry[1], best[1]) < 0) best = entry
    return best![0]
  }

  best(): PlacementScore {
    return this.scores.get(this.bestKey())!
  }

  // The placements within the margin of the best: those already scored, and
  // with `spread` those found step by step from them. A better placement found
  // on the way becomes the best and the spread starts again from it.
  equallyGood(margin: number, spread: boolean): { keys: string[]; complete: boolean } {
    for (;;) {
      const best = this.best()
      const within = (score: PlacementScore) => asGoodAs(score, best, margin)
      const found = new Set(
        [...this.scores].filter(([, score]) => within(score)).map(([key]) => key),
      )
      if (!spread) return { keys: [...found], complete: true }
      const queue = [...found]
      let complete = true
      for (let next = 0; next < queue.length; next++) {
        if (found.size >= EQUAL_CAP) {
          complete = false
          break
        }
        for (const positions of this.neighbours(positionsOf(queue[next]!))) {
          const key = keyOf(positions)
          if (found.has(key) || !within(this.evaluate(positions))) continue
          found.add(key)
          queue.push(key)
        }
      }
      if (compare(this.best(), best) === 0) return { keys: [...found], complete }
    }
  }
}

function* everyPlacement(tiles: number[], count: number): Generator<number[]> {
  const positions: number[] = []
  const used = new Set<number>()
  function* fill(): Generator<number[]> {
    if (positions.length === count) {
      yield [...positions]
      return
    }
    for (const hexId of tiles) {
      if (used.has(hexId)) continue
      used.add(hexId)
      positions.push(hexId)
      yield* fill()
      positions.pop()
      used.delete(hexId)
    }
  }
  yield* fill()
}

function searched(
  team: PlacementTeam,
  mapKey: string,
  data: PlacementData,
  lookups: PlacementLookups,
  options: PlacementOptions,
): { board: PlacementBoard; scorer: PlacementScorer; search: Search } {
  const board = new PlacementBoard(team, mapKey, lookups)
  const scorer = new PlacementScorer(board, team, data)
  const held = board.units.map((unit) => options.held?.get(unit))
  const movable = held.flatMap((hexId, i) => (hexId === undefined ? [i] : []))
  const open = board.tiles.filter((hexId) => !held.includes(hexId))
  // A placement with the moving units on `tiles`, in order.
  const fill = (tiles: readonly number[]): number[] => {
    let next = 0
    return held.map((hexId) => hexId ?? tiles[next++]!)
  }
  const search = new Search(board, scorer, movable)
  if (options.full) {
    for (const tiles of everyPlacement(open, movable.length)) search.evaluate(fill(tiles))
  } else {
    const random = seeded(`${mapKey}|${board.units.join(',')}|${team.artifact ?? ''}`)
    for (let start = 0; start < STARTS; start++) {
      const tiles = [...open]
      for (let i = tiles.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1))
        ;[tiles[i], tiles[j]] = [tiles[j]!, tiles[i]!]
      }
      search.climb(fill(tiles))
    }
  }
  return { board, scorer, search }
}

/**
 * Places a team on a map's ally tiles: scores placements by the rules of its
 * units, its artifact and its charms, the map's buff tile, the rules found in
 * the formations and where its heroes lean, and the rules of the enemy units it
 * could face there, and returns the best, with how many were about as good and
 * which tiles each hero kept among them. A rebuild gives the same placement.
 */
export function placeTeam(
  team: PlacementTeam,
  mapKey: string,
  data: PlacementData,
  lookups: PlacementLookups,
  options: PlacementOptions = {},
): PlacementResult {
  const { board, scorer, search } = searched(team, mapKey, data, lookups, options)
  const { keys, complete } = search.equallyGood(data.weights.margin ?? 0, !options.full)

  // The highest total among them, the enemy units' rules counted, then the
  // lowest tiles in the units' order. The enemy units' rules are read only
  // here, since each is tried on every enemy tile and a team's own goals come
  // first. They add at most their ceiling, so once a placement's own total
  // falls that far below the best so far, it and every lower one are passed by,
  // and a placement's rules stop being read once the rest cannot lift it to the
  // best.
  const byTiles = (a: number[], b: number[]) => {
    const i = a.findIndex((hexId, k) => hexId !== b[k])
    return i < 0 ? 0 : a[i]! - b[i]!
  }
  const ceiling = scorer.threatCeiling
  const byTotal = keys
    .map((key) => ({ positions: positionsOf(key), total: search.scores.get(key)!.total }))
    .sort((a, b) => b.total - a.total)
  let pick: { positions: number[]; total: number } | undefined
  for (const { positions, total: own } of byTotal) {
    if (pick && own + ceiling < pick.total - EPS) break
    board.place(positions)
    const threats = scorer.threatsReaching(pick ? pick.total - EPS - own : -Infinity)
    if (threats === null) continue
    const total = own + threats
    if (
      !pick ||
      (Math.abs(total - pick.total) > EPS
        ? total > pick.total
        : byTiles(positions, pick.positions) < 0)
    ) {
      pick = { positions, total }
    }
  }
  const kept = team.heroes.map((_, i) =>
    [...new Set(keys.map((key) => positionsOf(key)[i]!))].sort((a, b) => a - b),
  )
  return {
    units: board.units,
    positions: pick!.positions,
    best: search.best(),
    equallyGood: keys.length,
    complete,
    kept,
  }
}

/**
 * The points a team's own goals earn in the best placement the search finds on
 * a map, the buff tile's left out.
 */
export function effectPoints(
  team: PlacementTeam,
  mapKey: string,
  data: PlacementData,
  lookups: PlacementLookups,
): number {
  const { board, scorer, search } = searched(team, mapKey, data, lookups, {})
  board.place(positionsOf(search.bestKey()))
  return scorer.effectPoints()
}

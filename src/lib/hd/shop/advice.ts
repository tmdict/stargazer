// Which move an answer shows. The solvers give every first move its number;
// the rules here settle ties, and keep an answer from advising a change that
// gains nothing. A chance is compared by its floor, the figure a player can
// count on, so the same rules serve a range and a finished answer.

import type { CostRow, MinBadges } from './minBadges'
import { SHOWS_AS_ZERO } from './nextRound'
import type { ChanceRange, Move } from './types'

export interface ChanceRow {
  move: Move
  chance: ChanceRange
}

export interface ChanceAdvice {
  /** Null when no move open to the player can reach the goal this round: the advice is to stop. */
  best: ChanceRow | null
  /** Whether no other move can beat the best one, whatever its range narrows to. */
  certain: boolean
  /** The best move that leaves the locks on other targets' cards alone, when that is another move. */
  keepLocks: ChanceRow | null
  /** The move the comparison starts from, when it is neither of the two above. */
  current: ChanceRow | null
}

export interface ChanceQuestion {
  /** Every first move open to the player. */
  rows: readonly ChanceRow[]
  /** The row the comparison starts from: a reroll with the locks as entered, unless the player chose another. */
  current: ChanceRow | null
  /** Whether a move can be advised for this goal: a reroll, or buying a card that helps it. */
  helps: (move: Move) => boolean
  /** Whether a card is the goal's own: a wanted hero or piece, not a pack. */
  own: (card: number) => boolean
  /** The locks already set on other targets' cards. */
  kept: readonly number[]
  /** Card places, the cheaper purchase first, for purchases with the same chance. */
  order: readonly number[]
}

const SAME = 1e-12

/** Whether `a` is above `b` by enough to show. */
const gains = (a: number, b: number): boolean => a - b >= SHOWS_AS_ZERO

export const sameMove = (a: Move, b: Move): boolean =>
  a.kind === 'buy'
    ? b.kind === 'buy' && a.card === b.card
    : b.kind === 'reroll' &&
      a.locks.length === b.locks.length &&
      a.locks.every((card) => b.locks.includes(card))

export const keepsLocks = (move: Move, kept: readonly number[]): boolean =>
  move.kind === 'buy' || kept.every((card) => move.locks.includes(card))

/**
 * The rows of best chance. The highest chance wins, and a purchase wins an
 * exact tie with a reroll. Then, in order: purchases with the same chance go by
 * `order`; a winner that shows no gain over the current row gives way to it; a
 * reroll gives way to buying the goal's own card when that shows no less; and a
 * chance that shows as zero is a stop.
 */
export function adviseChance(asked: ChanceQuestion): ChanceAdvice {
  const { rows, current, helps, own, kept, order } = asked
  const p = (row: ChanceRow) => row.chance.floor
  const open = rows.filter((row) => helps(row.move))
  const start = current && helps(current.move) ? current : null

  const top = (list: readonly ChanceRow[]): ChanceRow | null => {
    let found: ChanceRow | null = null
    for (const row of list) {
      const tie = found !== null && Math.abs(p(row) - p(found)) < SAME
      if (
        !found ||
        p(row) > p(found) + SAME ||
        (tie && row.move.kind === 'buy' && found.move.kind === 'reroll')
      ) {
        found = row
      }
    }
    return found
  }
  const direct = (row: ChanceRow | null): ChanceRow | null => {
    if (!row || row.move.kind === 'buy') return row
    const card = open.find(
      (other) => other.move.kind === 'buy' && own(other.move.card) && !gains(p(row), p(other)),
    )
    return card ?? row
  }

  const highest = top(open)
  let best = highest
  if (best?.move.kind === 'buy') {
    const at = (row: ChanceRow) => (row.move.kind === 'buy' ? order.indexOf(row.move.card) : -1)
    const level = p(best)
    const tied = open.filter(
      (row) => row.move.kind === 'buy' && Math.abs(p(row) - level) < SHOWS_AS_ZERO,
    )
    best = tied.sort((a, b) => at(a) - at(b))[0] ?? best
  }
  if (best && start && !gains(p(best), p(start))) best = start
  best = direct(best)
  if (!best || p(best) < SHOWS_AS_ZERO) {
    return { best: null, certain: true, keepLocks: null, current: null }
  }

  let keeping = kept.length ? direct(top(open.filter((row) => keepsLocks(row.move, kept)))) : null
  if (keeping && start && keepsLocks(start.move, kept) && !gains(p(keeping), p(start))) {
    keeping = start
  }
  if (keeping === best) keeping = null

  const limit = highest ? p(highest) : 0
  return {
    best,
    certain: open.every((row) => row.chance.ceiling <= limit + 1e-9),
    keepLocks: keeping,
    current: current && current !== best && current !== keeping ? current : null,
  }
}

export interface BadgeAdvice {
  /** The cheapest first move, or null when the goal can never show with these settings. */
  best: CostRow | null
  /**
   * The cheapest move that buys another card or keeps other cards of the wanted
   * hero than the best one, and is not the row below.
   */
  next: CostRow | null
  /** The cheapest move that leaves the locks on other targets' cards alone, when that is another move. */
  keepLocks: CostRow | null
}

/** The rows of fewest badges, before the stop checks. */
export function adviseBadges(min: MinBadges, kept: readonly number[]): BadgeAdvice {
  const moves = min.options.flat()
  const best = min.best(moves)
  if (!best) return { best: null, next: null, keepLocks: null }
  const keeping = kept.length ? min.best(moves.filter((move) => keepsLocks(move, kept))) : null
  const keepLocks = keeping && !sameMove(keeping.move, best.move) ? keeping : null
  const next = min.options
    .filter((group) => !group.some((move) => sameMove(move, best.move)))
    .flatMap((group) => min.best(group) ?? [])
    .filter((row) => !(keepLocks && sameMove(row.move, keepLocks.move)))
    .sort((a, b) => a.cost.ceiling - b.cost.ceiling)[0]
  return { best, next: next ?? null, keepLocks }
}

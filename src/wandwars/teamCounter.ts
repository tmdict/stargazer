import type { CounterMatrix, MatchResult } from './types'

/** Historical record of a candidate trio against the known opponents. */
export interface TeamCounterInfo {
  wins: number
  losses: number
  total: number
}

/** One hero-vs-opponent counter relationship shown on a recommendation card. */
export interface CounterIndicator {
  opponent: string
  type: 'counters' | 'countered'
  score: number
}

// Counter score threshold: > 0.1 = strong against, < -0.1 = weak against
const COUNTER_THRESHOLD = 0.1

/**
 * Record of every candidate trio (teammates + one more hero) against the known
 * opponents, in a single pass over the match list.
 *
 * A match qualifies when the teammates are all on one side and the opponents
 * all on the other (the opponent team may have an unknown 3rd). Each
 * qualifying match credits the heroes that complete the teammates' side, so
 * the per-hero result equals scanning the matches once per candidate at a
 * fraction of the cost. Draws count toward total but neither wins nor losses.
 * Needs 2+ heroes known on both sides to say anything useful; returns an
 * empty map otherwise.
 */
export function buildTeamCounterMap(
  matches: MatchResult[],
  teammates: string[],
  opponents: string[],
): Map<string, TeamCounterInfo> {
  const map = new Map<string, TeamCounterInfo>()
  if (opponents.length < 2 || teammates.length < 2) return map

  const teammateSet = new Set(teammates)

  const credit = (side: readonly string[], won: boolean, lost: boolean) => {
    for (const hero of side) {
      if (teammateSet.has(hero)) continue
      let info = map.get(hero)
      if (!info) {
        info = { wins: 0, losses: 0, total: 0 }
        map.set(hero, info)
      }
      info.total++
      if (won) info.wins++
      else if (lost) info.losses++
    }
  }

  for (const match of matches) {
    const leftSet = new Set(match.left)
    const rightSet = new Set(match.right)

    if (teammates.every((h) => leftSet.has(h)) && opponents.every((h) => rightSet.has(h))) {
      credit(match.left, match.result === 'left', match.result === 'right')
    } else if (teammates.every((h) => rightSet.has(h)) && opponents.every((h) => leftSet.has(h))) {
      credit(match.right, match.result === 'right', match.result === 'left')
    }
  }

  return map
}

/**
 * Per-hero counter indicators against the known opponents, from the
 * precomputed counter matrix. Heroes with no indicator are omitted.
 * Ordering: 'counters' (strong against) before 'countered' (weak against),
 * then by descending score magnitude within each group.
 */
export function buildCounterIndicatorMap(
  counterMatrix: CounterMatrix,
  opponents: string[],
): Map<string, CounterIndicator[]> {
  const map = new Map<string, CounterIndicator[]>()
  if (opponents.length === 0) return map

  for (const hero of Object.keys(counterMatrix)) {
    const indicators: CounterIndicator[] = []
    for (const opp of opponents) {
      const score = counterMatrix[hero]?.[opp]?.score ?? 0
      if (score > COUNTER_THRESHOLD) {
        indicators.push({ opponent: opp, type: 'counters', score })
      } else if (score < -COUNTER_THRESHOLD) {
        indicators.push({ opponent: opp, type: 'countered', score })
      }
    }
    if (indicators.length === 0) continue

    indicators.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'counters' ? -1 : 1
      return Math.abs(b.score) - Math.abs(a.score)
    })
    map.set(hero, indicators)
  }

  return map
}

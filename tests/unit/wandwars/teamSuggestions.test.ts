import { describe, expect, it } from 'vitest'

import { getExactTrios } from '@/wandwars/prediction/teamSuggestions'
import type { MatchResult } from '@/wandwars/types'

const m = (
  left: [string, string, string],
  right: [string, string, string],
  result: MatchResult['result'],
): MatchResult => ({ left, right, result, weight: 1, notes: [], patch: 'test' })

describe('getExactTrios', () => {
  it('a drawn match counts in the record but does not dilute the winrate', () => {
    const trios = getExactTrios(
      ['a', 'b'],
      [m(['a', 'b', 'c'], ['x', 'y', 'z'], 'left'), m(['a', 'b', 'c'], ['x', 'y', 'z'], 'draw')],
    )

    expect(trios).toHaveLength(1)
    // 1W 0L 1D with PRIOR 3: (1+3)/(1+6) = 4/7
    expect(trios[0]).toMatchObject({ wins: 1, losses: 0, draws: 1, total: 2 })
    expect(trios[0]!.winRate).toBeCloseTo(4 / 7, 12)
  })

  it('excludes trios below the minimum matches or without a winning record', () => {
    const trios = getExactTrios(
      ['a', 'b'],
      [
        m(['a', 'b', 'c'], ['x', 'y', 'z'], 'left'), // c: only 1 match
        m(['a', 'b', 'd'], ['x', 'y', 'z'], 'left'), // d: 1W 1L — not winning
        m(['a', 'b', 'd'], ['x', 'y', 'z'], 'right'),
      ],
    )

    expect(trios).toHaveLength(0)
  })
})

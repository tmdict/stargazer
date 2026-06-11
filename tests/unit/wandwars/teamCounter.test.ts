import { describe, expect, it } from 'vitest'

import {
  buildCounterIndicatorMap,
  buildTeamCounterMap,
  type TeamCounterInfo,
} from '@/wandwars/teamCounter'
import type { CounterMatrix, MatchResult } from '@/wandwars/types'

const m = (
  left: [string, string, string],
  right: [string, string, string],
  result: 'left' | 'right' | 'draw',
): MatchResult => ({ left, right, result, weight: 1, notes: [], patch: 'test' })

const TEAMMATES = ['a', 'b']
const OPPONENTS = ['x', 'y']

const MATCHES: MatchResult[] = [
  m(['a', 'b', 'c'], ['x', 'y', 'z'], 'left'), // c: win
  m(['a', 'b', 'c'], ['x', 'y', 'w'], 'right'), // c: loss
  m(['x', 'y', 'z'], ['a', 'b', 'd'], 'right'), // mirrored sides — d: win
  m(['a', 'b', 'e'], ['x', 'y', 'z'], 'draw'), // e: draw (total only)
  m(['a', 'c', 'd'], ['x', 'y', 'z'], 'left'), // teammates incomplete — no credit
  m(['a', 'b', 'f'], ['x', 'q', 'z'], 'left'), // opponents incomplete — no credit
]

describe('buildTeamCounterMap', () => {
  const map = buildTeamCounterMap(MATCHES, TEAMMATES, OPPONENTS)

  it('credits candidates completing the teammate side, on either side of the record', () => {
    expect(map.get('c')).toEqual({ wins: 1, losses: 1, total: 2 })
    expect(map.get('d')).toEqual({ wins: 1, losses: 0, total: 1 })
  })

  it('counts draws toward total but neither wins nor losses', () => {
    expect(map.get('e')).toEqual({ wins: 0, losses: 0, total: 1 })
  })

  it('does not credit teammates, opponents, or heroes from non-qualifying matches', () => {
    const credited = ['a', 'b', 'x', 'y', 'z', 'f'].filter((hero) => map.has(hero))
    expect(credited).toEqual([])
  })

  it('returns an empty map until 2+ heroes are known on both sides', () => {
    expect(buildTeamCounterMap(MATCHES, ['a'], OPPONENTS).size).toBe(0)
    expect(buildTeamCounterMap(MATCHES, TEAMMATES, ['x']).size).toBe(0)
  })

  // The map replaced a per-candidate scan in WandWarsAnalysis.vue; this oracle
  // is that original algorithm, kept to pin the loop-inversion equivalence.
  it('matches the per-candidate scan it replaced, for every hero', () => {
    const oracle = (hero: string): TeamCounterInfo | null => {
      const myTeam = [...TEAMMATES, hero]
      let wins = 0
      let losses = 0
      let total = 0
      for (const match of MATCHES) {
        const leftSet = new Set(match.left)
        const rightSet = new Set(match.right)
        const myOnLeft =
          myTeam.every((h) => leftSet.has(h)) && OPPONENTS.every((h) => rightSet.has(h))
        const myOnRight =
          myTeam.every((h) => rightSet.has(h)) && OPPONENTS.every((h) => leftSet.has(h))
        if (!myOnLeft && !myOnRight) continue
        total++
        if (myOnLeft && match.result === 'left') wins++
        else if (myOnLeft && match.result === 'right') losses++
        else if (myOnRight && match.result === 'right') wins++
        else if (myOnRight && match.result === 'left') losses++
      }
      return total === 0 ? null : { wins, losses, total }
    }

    // Candidates are never current teammates, so those are excluded
    const candidates = [
      ...new Set(MATCHES.flatMap((match) => [...match.left, ...match.right])),
    ].filter((hero) => !TEAMMATES.includes(hero))

    const actual = Object.fromEntries(candidates.map((hero) => [hero, map.get(hero) ?? null]))
    const expected = Object.fromEntries(candidates.map((hero) => [hero, oracle(hero)]))
    expect(actual).toEqual(expected)
  })
})

describe('buildCounterIndicatorMap', () => {
  const entry = (score: number) => ({ matches: 1, wins: 1, losses: 0, score })
  const matrix: CounterMatrix = {
    hero1: { x: entry(0.3), y: entry(-0.2) },
    hero2: { x: entry(0.05), y: entry(0.08) }, // both inside the threshold
    hero3: { x: entry(0.15), y: entry(0.4) },
  }

  it('classifies by threshold and sorts counters first, then by magnitude', () => {
    const map = buildCounterIndicatorMap(matrix, ['x', 'y'])
    expect(map.get('hero1')).toEqual([
      { opponent: 'x', type: 'counters', score: 0.3 },
      { opponent: 'y', type: 'countered', score: -0.2 },
    ])
    expect(map.get('hero3')).toEqual([
      { opponent: 'y', type: 'counters', score: 0.4 },
      { opponent: 'x', type: 'counters', score: 0.15 },
    ])
  })

  it('omits heroes with no indicator and returns empty with no opponents', () => {
    expect(buildCounterIndicatorMap(matrix, ['x', 'y']).has('hero2')).toBe(false)
    expect(buildCounterIndicatorMap(matrix, []).size).toBe(0)
  })
})

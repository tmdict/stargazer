import { describe, expect, it } from 'vitest'

import { analyzeMatches } from '@/wandwars/prediction/analysis'
import { fitBradleyTerry, getCachedBradleyTerryFit } from '@/wandwars/prediction/bradleyTerry'
import type { MatchResult } from '@/wandwars/types'

// The MM fit iterates to a numeric fixed point, so these tests pin invariants
// (complement, clamp bounds, orderings) rather than exact strength values.
const m = (
  left: [string, string, string],
  right: [string, string, string],
  result: MatchResult['result'],
): MatchResult => ({ left, right, result, weight: 1, notes: [], patch: 'test' })

describe('predict complement and strength ordering', () => {
  const HEROES = ['a1', 'a2', 'a3', 'b1', 'b2', 'b3']
  const MATCHES = [
    m(['a1', 'a2', 'a3'], ['b1', 'b2', 'b3'], 'left'),
    m(['a1', 'a2', 'a3'], ['b1', 'b2', 'b3'], 'left'),
    m(['b1', 'b2', 'b3'], ['a1', 'a2', 'a3'], 'left'),
    m(['a1', 'b1', 'a2'], ['b2', 'a3', 'b3'], 'draw'),
  ]
  const fit = fitBradleyTerry(MATCHES, analyzeMatches(MATCHES, HEROES))

  it('predict(L,R) + predict(R,L) = 1, surviving the clamp', () => {
    // Base prob is exactly complementary and the pair adjustment flips sign,
    // so pre-clamp values are p and 1−p; the [0.05, 0.95] bounds are symmetric
    // about 0.5, so clamping preserves the identity.
    const teams: [string[], string[]][] = [
      [
        ['a1', 'a2', 'a3'],
        ['b1', 'b2', 'b3'],
      ],
      [
        ['a1', 'b2', 'a3'],
        ['b1', 'a2', 'b3'],
      ],
      // Unknown hero falls back to strength 1; the identity must still hold
      [
        ['a1', 'a2', 'zz'],
        ['b1', 'b2', 'b3'],
      ],
    ]
    for (const [left, right] of teams) {
      expect(fit.predict(left, right) + fit.predict(right, left)).toBeCloseTo(1, 12)
    }
  })

  it('ranks a winning hero above a losing one', () => {
    expect(fit.strengths.get('a1')!).toBeGreaterThan(fit.strengths.get('b1')!)
  })
})

describe('clamp under an extreme fixture', () => {
  const HEROES = ['a1', 'a2', 'a3', 'b1', 'b2', 'b3']
  // 60-0 record drives the base probability past the bounds in both directions
  const MATCHES = Array.from({ length: 60 }, () =>
    m(['a1', 'a2', 'a3'], ['b1', 'b2', 'b3'], 'left'),
  )
  const fit = fitBradleyTerry(MATCHES, analyzeMatches(MATCHES, HEROES))

  it('caps predictions at exactly 0.95 / 0.05', () => {
    expect(fit.predict(['a1', 'a2', 'a3'], ['b1', 'b2', 'b3'])).toBe(0.95)
    expect(fit.predict(['b1', 'b2', 'b3'], ['a1', 'a2', 'a3'])).toBe(0.05)
  })
})

describe('regularization pull toward the λ = 1 baseline', () => {
  // Two undefeated heroes in identical contexts; only their match counts differ.
  const HEROES = ['many', 'few', 'm2', 'm3', 'o1', 'o2', 'o3']
  const MATCHES = [
    ...Array.from({ length: 8 }, () => m(['many', 'm2', 'm3'], ['o1', 'o2', 'o3'], 'left')),
    m(['few', 'm2', 'm3'], ['o1', 'o2', 'o3'], 'left'),
  ]
  const fit = fitBradleyTerry(MATCHES, analyzeMatches(MATCHES, HEROES))

  it('pulls the 1-match hero closer to baseline than the 8-match hero', () => {
    const many = fit.strengths.get('many')!
    const few = fit.strengths.get('few')!
    expect(Math.abs(few - 1)).toBeLessThan(Math.abs(many - 1))
    // The pull still leaves the undefeated hero above the all-losing one
    expect(few).toBeGreaterThan(fit.strengths.get('o1')!)
  })
})

describe('getCachedBradleyTerryFit', () => {
  const HEROES = ['a1', 'a2', 'a3', 'b1', 'b2', 'b3']
  const MATCHES = [
    m(['a1', 'a2', 'a3'], ['b1', 'b2', 'b3'], 'left'),
    m(['b1', 'b2', 'b3'], ['a1', 'a2', 'a3'], 'right'),
    m(['a1', 'a2', 'a3'], ['b1', 'b2', 'b3'], 'right'),
  ]
  const analysis = analyzeMatches(MATCHES, HEROES)

  it('reuses the fit for the same matches reference and refits for a new one', () => {
    const first = getCachedBradleyTerryFit(MATCHES, analysis)
    expect(getCachedBradleyTerryFit(MATCHES, analysis)).toBe(first)

    // Same content, new reference → refit; the fit is deterministic, so the
    // new object predicts identically
    const refit = getCachedBradleyTerryFit([...MATCHES], analysis)
    expect(refit).not.toBe(first)
    expect(refit.predict(['a1', 'a2', 'a3'], ['b1', 'b2', 'b3'])).toBeCloseTo(
      first.predict(['a1', 'a2', 'a3'], ['b1', 'b2', 'b3']),
      12,
    )
  })
})

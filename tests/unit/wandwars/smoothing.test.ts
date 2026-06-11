import { describe, expect, it } from 'vitest'

import { smoothedWinRate } from '@/wandwars/prediction/smoothing'

describe('smoothedWinRate', () => {
  it('returns exactly 0.5 at zero evidence', () => {
    // Call sites rely on this instead of guarding empty records themselves
    expect(smoothedWinRate(0, 0, 3)).toBe(0.5)
    expect(smoothedWinRate(0, 0, 1)).toBe(0.5)
  })

  it('computes (wins + prior) / (wins + losses + 2·prior)', () => {
    expect(smoothedWinRate(2, 0, 3)).toBeCloseTo(5 / 8, 12)
    expect(smoothedWinRate(3, 1, 3)).toBeCloseTo(0.6, 12)
  })

  it('the prior fades as evidence grows', () => {
    // Same 60% raw rate, more evidence → closer to 0.6
    expect(smoothedWinRate(30, 20, 3)).toBeGreaterThan(smoothedWinRate(12, 8, 3))
    expect(smoothedWinRate(30, 20, 3)).toBeLessThan(0.6)
  })
})

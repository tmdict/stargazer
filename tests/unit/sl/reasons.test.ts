import { describe, expect, it } from 'vitest'

import { sigmoid } from '@/lib/pvp/sl/model/fit'
import { splitChance } from '@/lib/pvp/sl/model/reasons'
import { REASONS, type Reason } from '@/lib/pvp/sl/model/types'

const random = (seed: number) => () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
  return seed / 2 ** 32
}

const factorial = (n: number): number => (n <= 1 ? 1 : n * factorial(n - 1))

// Each reason's exact worth in tenths of a point, from the subset form of the
// Shapley value: every set of the other reasons, weighted by how many orders
// add this reason right after that set.
const exactTenths = (parts: Record<Reason, number>): Record<Reason, number> => {
  const n = REASONS.length
  const worth = (set: Reason[]) => sigmoid(set.reduce((edge, r) => edge + parts[r], 0))
  return Object.fromEntries(
    REASONS.map((reason) => {
      const others = REASONS.filter((r) => r !== reason)
      let value = 0
      for (let mask = 0; mask < 2 ** others.length; mask++) {
        const set = others.filter((_, i) => mask & (1 << i))
        const weight = (factorial(set.length) * factorial(n - set.length - 1)) / factorial(n)
        value += weight * (worth([...set, reason]) - worth(set))
      }
      return [reason, value * 1000]
    }),
  ) as Record<Reason, number>
}

describe('splitChance', () => {
  it('rounds the reasons to add up to the shown chance, each near its exact worth', () => {
    const next = random(3)
    let fixedUp = 0
    for (let i = 0; i < 5000; i++) {
      const parts = Object.fromEntries(REASONS.map((r) => [r, (next() - 0.5) * 4])) as Record<
        Reason,
        number
      >
      const { chance, shown, reasons } = splitChance(parts)
      const exact = exactTenths(parts)
      expect(Math.abs(shown - chance * 1000)).toBeLessThanOrEqual(0.5)
      expect(REASONS.reduce((sum, r) => sum + reasons[r], 0)).toBe(shown - 500)
      for (const r of REASONS) expect(Math.abs(reasons[r] - exact[r])).toBeLessThanOrEqual(1.5)
      if (REASONS.reduce((sum, r) => sum + Math.round(exact[r]), 0) !== shown - 500) fixedUp++
    }
    // Rounding each reason alone must miss in some cases, or the fix-up went untested.
    expect(fixedUp).toBeGreaterThan(0)
  })
})

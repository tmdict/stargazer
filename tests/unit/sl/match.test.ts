import { describe, expect, it } from 'vitest'

import { matchOdds } from '@/lib/pvp/sl/www/match'

describe('matchOdds', () => {
  it('gives the binomial chance of three games or more for five even games', () => {
    // 10 * 0.6^3 * 0.4^2 + 5 * 0.6^4 * 0.4 + 0.6^5
    const { chance, wins } = matchOdds([0.6, 0.6, 0.6, 0.6, 0.6])
    expect(chance).toBeCloseTo(0.68256, 10)
    expect(wins[5]).toBeCloseTo(0.07776, 10)
    expect(wins[0]).toBeCloseTo(0.01024, 10)
  })

  it('splits a match of mirrored games evenly', () => {
    // Each game against its mirror makes the number of games A wins symmetric
    // about two and a half.
    const { chance, wins } = matchOdds([0.9, 0.1, 0.75, 0.25, 0.5])
    expect(chance).toBeCloseTo(0.5, 10)
    for (let k = 0; k <= 5; k++) expect(wins[k]).toBeCloseTo(wins[5 - k]!, 10)
  })
})

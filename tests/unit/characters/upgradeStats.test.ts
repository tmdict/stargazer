import { describe, expect, it } from 'vitest'

import { PARAGON_RAMPS, REFINEMENT_RAMPS } from '@/lib/characters/upgradeStats'
import { loadAppLocales } from '@/utils/dataLoader'

describe('upgradeStats', () => {
  it('names every ramp stat with an app locale entry', () => {
    const locales = loadAppLocales()
    const stats = [
      ...Object.values(PARAGON_RAMPS).flatMap((ramps) => Object.values(ramps)),
      ...REFINEMENT_RAMPS,
    ].flatMap((ramp) => ramp.stats)
    expect(stats.filter((key) => locales[key] === undefined)).toEqual([])
  })
})

import { describe, expect, it } from 'vitest'

import { ATTR_PARAGON, ATTR_REFINEMENT } from '@/lib/characters/attributes'
import { paragonStatValue } from '@/lib/characters/paragon'
import {
  PARAGON_RAMPS,
  paragonGroup,
  pillTone,
  rampValue,
  rampValues,
  REFINEMENT_RAMPS,
} from '@/lib/characters/upgradeStats'
import { loadAppLocales } from '@/utils/dataLoader'

describe('upgradeStats', () => {
  // The in-game P0..P4 table, pinned value by value.
  it('paragon ramps reproduce the in-game table for the four base factions', () => {
    const { energy, combat, rivalry } = PARAGON_RAMPS.standard
    expect(rampValues(energy, ATTR_PARAGON)).toEqual([0, 15, 30, 45, 60])
    expect(rampValues(combat, ATTR_PARAGON)).toEqual([0, 6, 12, 18, 24])
    expect(rampValues(rivalry, ATTR_PARAGON)).toEqual([0, 4.5, 9, 13.5, 18])
  })

  it('paragon ramps reproduce the in-game table for Celestial and Hypogean', () => {
    const { energy, combat, rivalry } = PARAGON_RAMPS.celestialHypogean
    expect(rampValues(energy, ATTR_PARAGON)).toEqual([14, 25.5, 37, 48.5, 60])
    expect(rampValues(combat, ATTR_PARAGON)).toEqual([6, 10.5, 15, 19.5, 24])
    expect(rampValues(rivalry, ATTR_PARAGON)).toEqual([4, 7.5, 11, 14.5, 18])
  })

  it('refinement ramps reproduce the in-game R0..R4 table', () => {
    expect(REFINEMENT_RAMPS.map((ramp) => rampValues(ramp, ATTR_REFINEMENT))).toEqual([
      [0, 4, 8, 12, 16],
      [0, 2, 4, 6, 8],
    ])
  })

  it('every faction meets at the max paragon level', () => {
    for (const key of ['energy', 'combat', 'rivalry'] as const) {
      expect(rampValue(PARAGON_RAMPS.standard[key], 4)).toBe(
        rampValue(PARAGON_RAMPS.celestialHypogean[key], 4),
      )
    }
  })

  it('groups only Celestial and Hypogean onto the second ramp', () => {
    expect(paragonGroup('celestial')).toBe('celestialHypogean')
    expect(paragonGroup('hypogean')).toBe('celestialHypogean')
    for (const faction of [
      'lightbearer',
      'mauler',
      'wilder',
      'graveborn',
      'dimensional',
      undefined,
    ]) {
      expect(paragonGroup(faction)).toBe('standard')
    }
  })

  it('drives the panel rivalry stat from the same rivalry ramp', () => {
    expect(paragonStatValue(3, 'wilder')).toBe(13.5)
    expect(paragonStatValue(3, 'celestial')).toBe(14.5)
  })

  it('names every ramp stat with an app locale entry', () => {
    const locales = loadAppLocales()
    const stats = [
      ...Object.values(PARAGON_RAMPS).flatMap((ramps) => Object.values(ramps)),
      ...REFINEMENT_RAMPS,
    ].flatMap((ramp) => ramp.stats)
    expect(stats.filter((key) => locales[key] === undefined)).toEqual([])
  })

  it('tones paragon at max only and refinement from R2', () => {
    expect([0, 1, 2, 3, 4].map((level) => pillTone(ATTR_PARAGON, level))).toEqual([
      'base',
      'base',
      'base',
      'base',
      'max',
    ])
    expect([0, 1, 2, 3, 4].map((level) => pillTone(ATTR_REFINEMENT, level))).toEqual([
      'base',
      'base',
      'mid',
      'mid',
      'max',
    ])
  })
})

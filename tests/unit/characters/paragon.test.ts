import { describe, expect, it } from 'vitest'

import { ATTR_PARAGON, attrMax } from '@/lib/characters/attributes'
import { paragonStatValue } from '@/lib/characters/paragon'

const PARAGON_MAX_LEVEL = attrMax(ATTR_PARAGON)

describe('paragon', () => {
  it('ramps base factions from 0 in 4.5 steps', () => {
    expect(paragonStatValue(0, 'lightbearer')).toBe(0)
    expect(paragonStatValue(1, 'wilder')).toBe(4.5)
    expect(paragonStatValue(2, 'mauler')).toBe(9)
    expect(paragonStatValue(3, 'graveborn')).toBe(13.5)
    expect(paragonStatValue(PARAGON_MAX_LEVEL, 'lightbearer')).toBe(18)
  })

  it('ramps celestials and hypogeans from 4 in 3.5 steps', () => {
    expect(paragonStatValue(0, 'celestial')).toBe(4)
    expect(paragonStatValue(1, 'hypogean')).toBe(7.5)
    expect(paragonStatValue(2, 'celestial')).toBe(11)
    expect(paragonStatValue(3, 'hypogean')).toBe(14.5)
    expect(paragonStatValue(PARAGON_MAX_LEVEL, 'celestial')).toBe(18)
  })

  it('treats an unknown faction as a base-faction ramp', () => {
    expect(paragonStatValue(2)).toBe(9)
    expect(paragonStatValue(2, 'dimensional')).toBe(9)
  })
})

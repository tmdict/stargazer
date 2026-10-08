import { describe, expect, it } from 'vitest'

import {
  fromMechanicQuery,
  matchesMechanic,
  toMechanicQuery,
  type MechanicPick,
} from '@/lib/mechanics'
import { tagVocabulary } from '@/lib/tags'

const vocabulary = tagVocabulary([
  { tags: { dot: [{ ex: 1 }], summon: [{ ultimate: 1 }], 'heal-denial': [{ skill2: 1 }] } },
])

describe('energy filter', () => {
  const above = (energy: number[], energyAbove: number): boolean =>
    matchesMechanic({ tags: {}, energy }, { energyAbove })

  it('counts what skills add and keeps only heroes above the value', () => {
    expect(above([500], 500)).toBe(false)
    expect(above([550], 500)).toBe(true)
    expect(above([200, 300], 400)).toBe(true)
    expect(above([200, 300], 500)).toBe(false)
    expect(above([0], 0)).toBe(false)
  })
})

describe('mechanic links', () => {
  const read = (query: Record<string, unknown>): MechanicPick | null =>
    fromMechanicQuery(query, vocabulary)

  it('round-trips an energy pick and still reads a tag link', () => {
    const query = toMechanicQuery({ energyAbove: 500 })
    expect(query).toEqual({ energy: '500' })
    expect(read(query)).toEqual({ energyAbove: 500 })
    expect(read({ energy: '0' })).toEqual({ energyAbove: 0 })
    expect(read(toMechanicQuery({ tag: 'dot', mods: [] }))).toEqual({ tag: 'dot', mods: [] })
  })

  it('reads a value the filter cannot be stepped to, or a link with both, as no filter', () => {
    const values = ['1000', '250', '-100', '', 'asd', null, ['500', '600']]
    expect(values.filter((energy) => read({ energy }) !== null)).toEqual([])
    expect(read({ energy: '500', tag: 'dot' })).toBeNull()
    expect(read({ energy: '500', mods: 'global' })).toBeNull()
  })

  it('reads only the plain number, so another spelling of a valid value is no filter', () => {
    const spellings = ['0500', '00', '+500', '500.0', '5e2', ' 500', '0x1F4']
    expect(spellings.filter((energy) => read({ energy }) !== null)).toEqual([])
  })
})

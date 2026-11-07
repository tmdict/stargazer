import { beforeEach, describe, expect, it } from 'vitest'

import { useEnergyValue } from '@/composables/useEnergyValue'
import { useMechanicPicks } from '@/composables/useMechanicPicks'
import { ENERGY_DEFAULT, ENERGY_KEY } from '@/lib/mechanics'
import { tagVocabulary } from '@/lib/tags'

describe('useMechanicPicks', () => {
  const vocabulary = tagVocabulary([{ tags: { 'temp-buff': [{ ultimate: 1 }] } }], () => false)

  // The energy value is shared by every instance.
  beforeEach(() => {
    useEnergyValue().value = ENERGY_DEFAULT
  })

  it('holds the energy filter beside tags, and a hero has to satisfy both', () => {
    const { picks, toggle, setEnergy, matches } = useMechanicPicks(vocabulary)
    const buffer = { tags: { 'temp-buff': [{ ultimate: 1 }] }, energy: [400, 200] }

    toggle('temp-buff')
    toggle(ENERGY_KEY)
    expect(picks.value).toEqual([{ energyAbove: 500 }, { tag: 'temp-buff', mods: [] }])
    expect(matches(buffer)).toBe(true)
    expect(matches({ ...buffer, tags: {} })).toBe(false)

    // A new value picks the filter, as a modifier picks its tag.
    toggle(ENERGY_KEY)
    setEnergy(600)
    expect(picks.value[0]).toEqual({ energyAbove: 600 })
    expect(matches(buffer)).toBe(false)
  })
})

import { ref } from 'vue'
import { beforeEach, describe, expect, it } from 'vitest'

import { useCharacterFilters } from '@/composables/useCharacterFilters'
import { useEnergyValue } from '@/composables/useEnergyValue'
import { ENERGY_DEFAULT } from '@/lib/mechanics'
import type { CharacterType } from '@/lib/types/character'
import type { CharacterTags } from '@/lib/types/skill'

const hero = (id: number, energy: number[], tags: CharacterTags = {}): CharacterType => ({
  id,
  name: `hero-${id}`,
  level: 's',
  faction: 'wilder',
  class: 'mage',
  damage: 'magic',
  energy,
  range: 1,
  season: 0,
  tags,
})

describe('useCharacterFilters', () => {
  const heroes = ref<readonly CharacterType[]>([
    hero(1, [400, 200], { dot: [{ ex: 1 }] }),
    hero(2, [500]),
    hero(3, [0], { dot: [{ ultimate: 1 }] }),
  ])
  const ids = (list: readonly CharacterType[]): number[] => list.map((c) => c.id)

  // The energy value is shared by every list.
  beforeEach(() => {
    useEnergyValue().value = ENERGY_DEFAULT
  })

  it('holds a tag pick or the energy pick, and only a tag pick opens a hero on its chips', () => {
    const { mechanicFilter, filteredCharacters, energyPicked, inspectChips } =
      useCharacterFilters(heroes)
    const dot = { tag: 'dot', mods: [] }

    mechanicFilter.value = dot
    expect(ids(filteredCharacters.value)).toEqual([1, 3])
    expect(inspectChips.value).toEqual([dot])

    mechanicFilter.value = { energyAbove: 500 }
    expect(ids(filteredCharacters.value)).toEqual([1])
    expect(energyPicked.value).toBe(true)
    expect(inspectChips.value).toBeUndefined()

    mechanicFilter.value = null
    expect(energyPicked.value).toBe(false)
    expect(ids(filteredCharacters.value)).toEqual([1, 2, 3])
  })

  it('filters every list with the energy pick on by the value last set in any of them', () => {
    const first = useCharacterFilters(heroes)
    const second = useCharacterFilters(heroes)

    first.mechanicFilter.value = { energyAbove: 500 }
    second.mechanicFilter.value = { energyAbove: 300 }
    expect(first.mechanicFilter.value).toEqual({ energyAbove: 300 })
    expect(ids(first.filteredCharacters.value)).toEqual([1, 2])
  })
})

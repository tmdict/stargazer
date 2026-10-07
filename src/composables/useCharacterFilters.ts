import { computed, readonly, ref, type Ref } from 'vue'

import { useEnergyValue } from '@/composables/useEnergyValue'
import { compareCharacters } from '@/lib/filterOrder'
import { isEnergyPick, matchesMechanic, type MechanicPick } from '@/lib/mechanics'
import type { CharacterType } from '@/lib/types/character'
import type { TagPick } from '@/lib/types/skill'

/** Filter state + filtered list. UI lives in CharacterFilterStrip. */
export function useCharacterFilters(characters: Ref<readonly CharacterType[]>) {
  const factionFilter = ref('')
  const classFilter = ref('')

  // A list holds a tag pick or the energy pick. The energy pick is built from
  // the shared value, so every list that has it on filters by the same number.
  const tagFilter = ref<TagPick | null>(null)
  const energyPicked = ref(false)
  const energyValue = useEnergyValue()
  const mechanicFilter = computed<MechanicPick | null>({
    get: () => (energyPicked.value ? { energyAbove: energyValue.value } : tagFilter.value),
    set: (pick) => {
      if (pick && isEnergyPick(pick)) {
        energyValue.value = pick.energyAbove
        energyPicked.value = true
        tagFilter.value = null
      } else {
        energyPicked.value = false
        tagFilter.value = pick
      }
    },
  })

  // Every filter but the mechanic one applied: the list the mechanics menu
  // counts in, so each count is what picking that entry would leave.
  const mechanicPool = computed(() =>
    characters.value.filter(
      (c) =>
        (!factionFilter.value || c.faction === factionFilter.value) &&
        (!classFilter.value || c.class === classFilter.value),
    ),
  )

  const filteredCharacters = computed(() => {
    const pick = mechanicFilter.value
    const filtered = pick
      ? mechanicPool.value.filter((c) => matchesMechanic(c, pick))
      : mechanicPool.value
    return [...filtered].sort(compareCharacters)
  })

  const inspectChips = computed(() => (tagFilter.value ? [tagFilter.value] : undefined))

  return {
    factionFilter,
    classFilter,
    mechanicFilter,
    mechanicPool,
    filteredCharacters,
    energyPicked: readonly(energyPicked),
    inspectChips,
  }
}

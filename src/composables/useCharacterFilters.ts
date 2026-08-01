import { computed, ref, type Ref } from 'vue'

import { compareFaction } from '@/lib/filterOrder'
import type { CharacterType } from '@/lib/types/character'

/** Filter state + filtered list. UI lives in CharacterFilterStrip. */
export function useCharacterFilters(characters: Ref<readonly CharacterType[]>) {
  const factionFilter = ref('')
  const classFilter = ref('')
  const damageFilter = ref('')
  const selectedTagNames = ref<string | null>(null)

  const filteredCharacters = computed(() => {
    let filtered = [...characters.value]
    if (factionFilter.value) filtered = filtered.filter((c) => c.faction === factionFilter.value)
    if (classFilter.value) filtered = filtered.filter((c) => c.class === classFilter.value)
    if (damageFilter.value) filtered = filtered.filter((c) => c.damage === damageFilter.value)
    if (selectedTagNames.value)
      filtered = filtered.filter((c) => Object.keys(c.tags).includes(selectedTagNames.value!))
    // Placeholders trail the whole roster as one block, in the faction filter
    // icons' order (compareFaction follows the same FACTION_ORDER).
    return filtered.sort(
      (a, b) =>
        (a.placeholder ? 1 : 0) - (b.placeholder ? 1 : 0) ||
        compareFaction(a.faction, b.faction) ||
        a.id - b.id,
    )
  })

  return {
    factionFilter,
    classFilter,
    damageFilter,
    selectedTagNames,
    filteredCharacters,
  }
}

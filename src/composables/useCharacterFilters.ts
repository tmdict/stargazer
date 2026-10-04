import { computed, ref, type Ref } from 'vue'

import { compareCharacters } from '@/lib/filterOrder'
import { matchesPick } from '@/lib/tags'
import type { CharacterType } from '@/lib/types/character'
import type { TagPick } from '@/lib/types/skill'

/** Filter state + filtered list. UI lives in CharacterFilterStrip. */
export function useCharacterFilters(characters: Ref<readonly CharacterType[]>) {
  const factionFilter = ref('')
  const classFilter = ref('')
  const tagFilter = ref<TagPick | null>(null)

  // Every filter but the tag one applied: the list the tag menu counts in, so
  // each count is what picking that entry would leave.
  const tagPool = computed(() =>
    characters.value.filter(
      (c) =>
        (!factionFilter.value || c.faction === factionFilter.value) &&
        (!classFilter.value || c.class === classFilter.value),
    ),
  )

  const filteredCharacters = computed(() => {
    const pick = tagFilter.value
    const filtered = pick ? tagPool.value.filter((c) => matchesPick(c.tags, pick)) : tagPool.value
    return [...filtered].sort(compareCharacters)
  })

  return { factionFilter, classFilter, tagFilter, tagPool, filteredCharacters }
}

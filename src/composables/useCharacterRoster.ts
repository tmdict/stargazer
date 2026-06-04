import { computed, onUnmounted, ref, watch, type Ref } from 'vue'

import { useCharacterFilters } from '@/composables/useCharacterFilters'
import { useSkillSearch, type SearchResult } from '@/composables/useSkillSearch'
import type { CharacterType } from '@/lib/types/character'
import type { Locale } from '@/lib/types/i18n'

const SEARCH_DEBOUNCE_MS = 150

/**
 * Roster state shared by the arena, /skills, and /guide rosters: the
 * faction/class/damage/tag filters plus debounced name + skill-text search.
 * `visibleSearchResults` is the search hits intersected with the active filters,
 * or null when the query is empty (callers render the filtered grid instead).
 */
export function useCharacterRoster(characters: Ref<readonly CharacterType[]>, lang: Ref<Locale>) {
  const filters = useCharacterFilters(characters)

  const searchQuery = ref('')
  const debouncedQuery = ref('')
  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  watch(searchQuery, (q) => {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => (debouncedQuery.value = q), SEARCH_DEBOUNCE_MS)
  })

  // Selecting a tag clears the search (both refs, to avoid a debounce flash).
  watch(filters.selectedTagNames, () => {
    if (!searchQuery.value) return
    if (debounceTimer) clearTimeout(debounceTimer)
    searchQuery.value = ''
    debouncedQuery.value = ''
  })

  onUnmounted(() => {
    if (debounceTimer) clearTimeout(debounceTimer)
  })

  const searchResults = useSkillSearch(debouncedQuery, lang)

  // Search ∩ filters; results keep useSkillSearch's hit-count ordering.
  const visibleSearchResults = computed<SearchResult[] | null>(() => {
    const results = searchResults.value
    if (!results) return null
    const allowed = new Set(filters.filteredCharacters.value.map((c) => c.name))
    return results.filter((r) => allowed.has(r.slug))
  })

  return { ...filters, searchQuery, visibleSearchResults }
}

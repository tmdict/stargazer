<script setup lang="ts">
import { computed } from 'vue'

import CharacterFilterStrip from './CharacterFilterStrip.vue'
import CharacterGrid from './CharacterGrid.vue'
import CharacterIcon from './CharacterIcon.vue'
import CharacterSearchBar from './CharacterSearchBar.vue'
import CharacterSearchResults from './CharacterSearchResults.vue'
import { useCharacterRoster } from '@/composables/useCharacterRoster'
import { useSelectionState } from '@/composables/useSelectionState'
import { canPlaceCharacterOnTeam } from '@/lib/characters/character'
import type { CharacterType } from '@/lib/types/character'
import { Team } from '@/lib/types/team'
import { useGridStore } from '@/stores/grid'
import { useGrids } from '@/stores/grids'
import { useI18nStore } from '@/stores/i18n'
import { getTeamFromTileState } from '@/utils/tileStateFormatting'

const {
  characters,
  isDraggable,
  // Internal flex-fill + own scroll on wide screens (the Arena's height-capped
  // column). Off when the roster flows in normal page height (5 v 5).
  scrollable = true,
} = defineProps<{
  characters: readonly CharacterType[]
  isDraggable?: boolean
  scrollable?: boolean
}>()

const { fillOrder, targetHexId, clearTargetHex, characterStore } = useSelectionState()
const gridStore = useGridStore()
const grids = useGrids()
const i18n = useI18nStore()

const {
  factionFilter,
  classFilter,
  damageFilter,
  selectedTagNames,
  filteredCharacters,
  searchQuery,
  visibleSearchResults,
} = useCharacterRoster(
  computed(() => characters),
  computed(() => i18n.currentLocale),
)

// Placement, uniqueness, and removal are page-wide (across every board); on the
// single Arena board this is identical to a per-board check. A hero is "placed"
// if it sits on either team, so the click toggle finds it wherever it is.
const placedTeam = (characterId: number): Team | null => {
  if (grids.findPlacement(characterId, Team.ALLY)) return Team.ALLY
  if (grids.findPlacement(characterId, Team.ENEMY)) return Team.ENEMY
  return null
}

const isCharacterPlaced = (characterId: number): boolean => placedTeam(characterId) !== null

const handleCharacterClick = (character: CharacterType) => {
  // Mobile: a tapped tile targets a specific cell on the active board — place the
  // hero there using that tile's team.
  if (targetHexId.value !== null) {
    const team = getTeamFromTileState(gridStore.getTile(targetHexId.value).state)
    if (
      team &&
      !grids.isUsed(character.id, team) &&
      canPlaceCharacterOnTeam(gridStore._getGrid(), character.id, team)
    ) {
      characterStore.placeCharacterOnHex(targetHexId.value, character.id, team)
    }
    clearTargetHex()
    return
  }
  const placed = placedTeam(character.id)
  if (placed !== null) {
    grids.removeFromAnyBoard(character.id, placed)
    return
  }
  // Fill the displayed-ally side first, then the displayed enemy side.
  for (const team of fillOrder.value) {
    if (grids.placeOnActive(character.id, team)) break
  }
}

// A search result places its hero exactly like clicking the roster icon would.
const handleResultSelect = (slug: string) => {
  const character = characters.find((c) => c.name === slug)
  if (character) handleCharacterClick(character)
}
</script>

<template>
  <div v-scroll-chain class="character-selection" :class="{ scrollable }">
    <CharacterSearchBar
      v-model="searchQuery"
      :placeholder="i18n.t('app.skill-search-placeholder')"
      :count="visibleSearchResults?.length ?? null"
      :count-label="i18n.t('app.skill-results')"
    />

    <CharacterFilterStrip
      v-model:faction-filter="factionFilter"
      v-model:class-filter="classFilter"
      v-model:damage-filter="damageFilter"
      v-model:tag-filter="selectedTagNames"
      :characters
    />

    <CharacterGrid v-if="!visibleSearchResults">
      <CharacterIcon
        v-for="character in filteredCharacters"
        :key="character.id"
        :character
        :is-draggable
        :is-placed="isCharacterPlaced(character.id)"
        :selected-filter="selectedTagNames"
        @character-click="handleCharacterClick"
      />
    </CharacterGrid>

    <CharacterSearchResults
      v-else
      :results="visibleSearchResults"
      :lang="i18n.currentLocale"
      :query="searchQuery"
      mode="action"
      @select="handleResultSelect"
    />
  </div>
</template>

<style scoped>
.character-selection {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  min-height: var(--panel-min-height);
}

/* On wide screens the right column is height-capped to the viewport, so the
   panel flex-fills the column and owns its own scroll; at the scroll boundary
   the wheel chains to the page (default overscroll behavior). On narrow screens
   (column-stacked layout) the panel grows to natural content height and the
   page handles scrolling — no internal scrollbar. */
@media (min-width: 1220px) {
  .character-selection.scrollable {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }
}
</style>

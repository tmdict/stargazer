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
import type { Team } from '@/lib/types/team'
import { useGridStore } from '@/stores/grid'
import { useI18nStore } from '@/stores/i18n'
import { getTeamFromTileState } from '@/utils/tileStateFormatting'

const props = defineProps<{
  characters: readonly CharacterType[]
  isDraggable?: boolean
}>()

const { selectedTeam, targetHexId, clearTargetHex, characterStore } = useSelectionState()
const gridStore = useGridStore()
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
  computed(() => props.characters),
  computed(() => i18n.currentLocale),
)

// Hex a character currently occupies on a given team, or null if unplaced.
const placedHexForTeam = (characterId: number, team: Team): number | null => {
  const tile = characterStore
    .getTilesWithCharacters()
    .find((t) => t.characterId === characterId && t.team === team)
  return tile ? tile.hex.getId() : null
}

const isCharacterPlaced = (characterId: number): boolean =>
  placedHexForTeam(characterId, selectedTeam.value) !== null

const handleCharacterClick = (character: CharacterType) => {
  // Mobile: a tapped tile targets a specific cell — place the hero there
  // (using that tile's team), regardless of the roster's selected team.
  if (targetHexId.value !== null) {
    const team = getTeamFromTileState(gridStore.getTile(targetHexId.value).state)
    if (team && canPlaceCharacterOnTeam(gridStore._getGrid(), character.id, team)) {
      characterStore.placeCharacterOnHex(targetHexId.value, character.id, team)
    }
    clearTargetHex()
    return
  }
  if (isCharacterPlaced(character.id)) {
    removeCharacterFromGrid(character.id)
    return
  }
  characterStore.autoPlaceCharacter(character.id, selectedTeam.value)
}

const removeCharacterFromGrid = (characterId: number) => {
  const hexId = placedHexForTeam(characterId, selectedTeam.value)
  if (hexId !== null) characterStore.removeCharacterFromHex(hexId)
}

// A search result places its hero exactly like clicking the roster icon would.
const handleResultSelect = (slug: string) => {
  const character = props.characters.find((c) => c.name === slug)
  if (character) handleCharacterClick(character)
}
</script>

<template>
  <div class="character-selection">
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
        :character="{ ...character, team: selectedTeam }"
        :isDraggable
        :isPlaced="isCharacterPlaced(character.id)"
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
  /* Contain overscroll so collapsing the sheet doesn't pull/refresh the page. */
  overscroll-behavior: contain;
}

/* On wide screens the right column is height-capped to the viewport, so the
   panel flex-fills the column and owns its own scroll. On narrow screens
   (column-stacked layout) the panel grows to natural content height and the
   page handles scrolling — no internal scrollbar. */
@media (min-width: 1220px) {
  .character-selection {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }
}
</style>

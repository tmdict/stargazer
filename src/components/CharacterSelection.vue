<script setup lang="ts">
import { computed } from 'vue'

import CharacterFilterStrip from './CharacterFilterStrip.vue'
import CharacterGrid from './CharacterGrid.vue'
import CharacterIcon from './CharacterIcon.vue'
import SkillSearchTrigger from '@/components/search/SkillSearchTrigger.vue'
import { useCharacterFilters } from '@/composables/useCharacterFilters'
import { useSelectionState } from '@/composables/useSelectionState'
import { useToast } from '@/composables/useToast'
import { canPlaceCharacterOnTeam } from '@/lib/characters/character'
import type { CharacterType } from '@/lib/types/character'
import { Team } from '@/lib/types/team'
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

const { fillOrder, targetHexId, targetGridId, clearTargetHex } = useSelectionState()
const grids = useGrids()
const i18n = useI18nStore()
const toast = useToast()

// Text search lives in the search overlay (select mode: a picked hero is placed,
// not navigated to); the panel keeps only the icon filters.
const { factionFilter, classFilter, damageFilter, selectedTagNames, filteredCharacters } =
  useCharacterFilters(computed(() => characters))

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
  // Mobile: a tapped tile targets a specific cell on its board. Place the hero
  // there using that tile's team, on that board (not whichever board is active).
  if (targetHexId.value !== null && targetGridId.value !== null) {
    const ctx = grids.getContext(targetGridId.value)
    if (ctx) {
      const team = getTeamFromTileState(ctx.grid.getTileById(targetHexId.value).state)
      if (
        team &&
        !grids.isUsed(character.id, team) &&
        canPlaceCharacterOnTeam(ctx.grid, character.id, team)
      ) {
        ctx.place(targetHexId.value, character.id, team)
      }
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

// A search result places its hero like a roster-icon click, minus the
// click's remove-toggle: the roster is hidden behind the overlay, so
// "select" must never act as removal. Targeted-tile placement still applies.
const handleResultSelect = (slug: string) => {
  const character = characters.find((c) => c.name === slug)
  if (!character) return
  if (targetHexId.value === null && isCharacterPlaced(character.id)) {
    // The overlay has already closed; without feedback the no-op reads as a bug.
    toast.show(i18n.t('app.search-already-placed'), 'info')
    return
  }
  handleCharacterClick(character)
}
</script>

<template>
  <div v-scroll-chain class="character-selection" :class="{ scrollable }">
    <div class="search-row">
      <SkillSearchTrigger :select="handleResultSelect" />
    </div>

    <CharacterFilterStrip
      v-model:faction-filter="factionFilter"
      v-model:class-filter="classFilter"
      v-model:damage-filter="damageFilter"
      v-model:tag-filter="selectedTagNames"
      :characters
    />

    <CharacterGrid>
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
  </div>
</template>

<style scoped>
.character-selection {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  min-height: var(--panel-min-height);
}

/* Clear the panel's scrollbar on desktop. */
.search-row {
  display: flex;
  padding-right: var(--spacing-lg);
}

@media (max-width: 768px) {
  .search-row {
    padding: var(--spacing-sm) var(--spacing-md) 0;
  }
  .search-row :deep(.search-trigger) {
    max-width: none;
  }
}

@media (max-width: 480px) {
  .search-row {
    padding: var(--spacing-sm) var(--spacing-sm) 0;
  }
}

/* On wide screens the right column is height-capped to the viewport, so the
   panel flex-fills the column and owns its own scroll; at the scroll boundary
   the wheel chains to the page (default overscroll behavior). On narrow screens
   (column-stacked layout) the panel grows to natural content height and the
   page handles scrolling: no internal scrollbar. */
@media (min-width: 1220px) {
  .character-selection.scrollable {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }
}
</style>

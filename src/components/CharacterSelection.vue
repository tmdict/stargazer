<script setup lang="ts">
import { computed } from 'vue'

import CharacterFilterStrip from './CharacterFilterStrip.vue'
import CharacterGrid from './CharacterGrid.vue'
import CharacterIcon from './CharacterIcon.vue'
import RosterMenu from './RosterMenu.vue'
import SkillSearchTrigger from '@/components/search/SkillSearchTrigger.vue'
import UpgradePill from '@/components/ui/UpgradePill.vue'
import { useCharacterFilters } from '@/composables/useCharacterFilters'
import { useSelectionState } from '@/composables/useSelectionState'
import { useToast } from '@/composables/useToast'
import { ATTR_PARAGON, ATTR_REFINEMENT } from '@/lib/characters/attributes'
import { isCharacterOnTeam, synergySlotFree } from '@/lib/characters/character'
import type { CharacterType } from '@/lib/types/character'
import { Team } from '@/lib/types/team'
import { useGrids } from '@/stores/grids'
import { useI18nStore } from '@/stores/i18n'
import { useRosters } from '@/stores/rosters'
import { getTeamFromTileState } from '@/utils/tileStateFormatting'

const {
  characters,
  isDraggable,
  // Internal flex-fill + own scroll on wide screens (the Arena's height-capped
  // column). Off when the picker flows in normal page height (5 v 5).
  scrollable = true,
} = defineProps<{
  characters: readonly CharacterType[]
  isDraggable?: boolean
  scrollable?: boolean
}>()

const { fillOrder, targetHexId, targetGridId, clearTargetHex, requestTab } = useSelectionState()
const grids = useGrids()
const i18n = useI18nStore()
const toast = useToast()
const rosters = useRosters()

// Text search lives in the search overlay (select mode: a picked hero is placed,
// not navigated to); the panel keeps only the icon filters.
const {
  factionFilter,
  classFilter,
  mechanicFilter,
  mechanicPool,
  filteredCharacters,
  energyPicked,
  inspectChips,
} = useCharacterFilters(computed(() => characters.filter(rosters.isPickable)))

// Placement, uniqueness, and removal are page-wide (across every board); on the
// single Arena board this is identical to a per-board check. A hero is "placed"
// if it sits on either team, so the click toggle finds it wherever it is.
const placedTeam = (characterId: number): Team | null => {
  if (grids.findPlacement(characterId, Team.ALLY)) return Team.ALLY
  if (grids.findPlacement(characterId, Team.ENEMY)) return Team.ENEMY
  return null
}

const isCharacterPlaced = (characterId: number): boolean => placedTeam(characterId) !== null

// While Syn is armed and the placed hero's own team still has a free assist
// slot, the next click places the duplicate, so the grey-out lifts to match.
const synergyCopyAvailable = (characterId: number): boolean => {
  const ctx = grids.active
  if (!grids.synergy || !ctx) return false
  const team = placedTeam(characterId)
  return (
    team !== null &&
    isCharacterOnTeam(ctx.grid, characterId, team) &&
    synergySlotFree(ctx.grid, team)
  )
}

const handleCharacterClick = (character: CharacterType) => {
  // Mobile: a tapped tile targets a specific cell on its board. Place the hero
  // there using that tile's team, on that board (not whichever board is active).
  if (targetHexId.value !== null && targetGridId.value !== null) {
    const ctx = grids.getContext(targetGridId.value)
    if (ctx) {
      const team = getTeamFromTileState(ctx.grid.getTileById(targetHexId.value).state)
      if (team) grids.placePick(ctx, character.id, team, targetHexId.value)
    }
    clearTargetHex()
    return
  }
  // Placeholders skip the remove-toggle: every click adds another copy.
  if (!character.placeholder) {
    const placed = placedTeam(character.id)
    if (placed !== null) {
      // The lifted grey-out promises the duplicate; otherwise the click is the
      // remove-toggle.
      if (synergyCopyAvailable(character.id)) grids.placeOnActive(character.id, placed)
      else grids.removeFromAnyBoard(character.id, placed)
      return
    }
  }
  for (const team of fillOrder) {
    if (grids.placeOnActive(character.id, team)) break
  }
}

// A search result places its hero like a picker-icon click, minus the
// click's remove-toggle: the picker is hidden behind the overlay, so
// "select" must never act as removal. Targeted-tile placement still applies.
const handleResultSelect = (slug: string) => {
  const character = characters.find((c) => c.name === slug)
  if (!character) return
  // The overlay has already closed, so each no-op below gets a toast; without
  // one it reads as a bug. Search finds every hero, the roster offers fewer.
  if (!rosters.isPickable(character)) {
    toast.show(i18n.t('app.no-available-heroes'), 'info')
    return
  }
  if (
    targetHexId.value === null &&
    isCharacterPlaced(character.id) &&
    !synergyCopyAvailable(character.id)
  ) {
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
      v-model:mechanic-filter="mechanicFilter"
      :characters
      :mechanic-pool
    >
      <template #menus>
        <RosterMenu manage large @manage="requestTab('rosters')" />
      </template>
    </CharacterFilterStrip>

    <CharacterGrid>
      <CharacterIcon
        v-for="character in filteredCharacters"
        :key="character.id"
        :character
        :is-draggable
        :dimmed="
          !character.placeholder &&
          isCharacterPlaced(character.id) &&
          !synergyCopyAvailable(character.id)
        "
        :show-energy="energyPicked"
        inspectable
        :inspect-chips
        @character-click="handleCharacterClick"
      >
        <!-- Placeholders have no levels; their pill is reserved to keep the grid even. -->
        <template v-if="rosters.active" #badge>
          <UpgradePill
            :reserved="!rosters.levelsFor(character.id)"
            :paragon="rosters.levelsFor(character.id)?.[ATTR_PARAGON] ?? 0"
            :refinement="rosters.levelsFor(character.id)?.[ATTR_REFINEMENT] ?? 0"
          />
        </template>
      </CharacterIcon>
    </CharacterGrid>
  </div>
</template>

<style scoped>
.character-selection {
  display: flex;
  flex-direction: column;
  gap: var(--picker-row-gap);
  min-height: var(--panel-min-height);
}

/* Clear the panel's scrollbar on desktop. */
.search-row {
  display: flex;
  padding-right: var(--spacing-lg);
}

@media (max-width: 768px) {
  .character-selection {
    --filter-inset: var(--spacing-md);
  }
  .search-row {
    padding: var(--spacing-sm) var(--spacing-md) 0;
  }
  .search-row :deep(.search-trigger) {
    max-width: none;
  }
}

@media (max-width: 480px) {
  .character-selection {
    --filter-inset: var(--spacing-sm);
  }
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

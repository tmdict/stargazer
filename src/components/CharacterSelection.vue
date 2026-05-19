<script setup lang="ts">
import { computed } from 'vue'

import CharacterFilterStrip from './CharacterFilterStrip.vue'
import CharacterIcon from './CharacterIcon.vue'
import { useCharacterFilters } from '@/composables/useCharacterFilters'
import { useSelectionState } from '@/composables/useSelectionState'
import type { CharacterType } from '@/lib/types/character'

const props = defineProps<{
  characters: readonly CharacterType[]
  isDraggable?: boolean
}>()

const { selectedTeam, characterStore } = useSelectionState()

const { factionFilter, classFilter, damageFilter, selectedTagNames, filteredCharacters } =
  useCharacterFilters(computed(() => props.characters))

const isCharacterPlaced = (characterId: number): boolean => {
  const tilesWithCharacters = characterStore.getTilesWithCharacters()
  return tilesWithCharacters.some(
    (tile) => tile.characterId === characterId && tile.team === selectedTeam.value,
  )
}

const handleCharacterClick = (character: CharacterType) => {
  if (isCharacterPlaced(character.id)) {
    removeCharacterFromGrid(character.id)
    return
  }
  characterStore.autoPlaceCharacter(character.id, selectedTeam.value)
}

const removeCharacterFromGrid = (characterId: number) => {
  const tilesWithCharacters = characterStore.getTilesWithCharacters()
  const characterTile = tilesWithCharacters.find(
    (tile) => tile.characterId === characterId && tile.team === selectedTeam.value,
  )
  if (characterTile) {
    characterStore.removeCharacterFromHex(characterTile.hex.getId())
  }
}
</script>

<template>
  <div class="character-selection">
    <CharacterFilterStrip
      v-model:faction-filter="factionFilter"
      v-model:class-filter="classFilter"
      v-model:damage-filter="damageFilter"
      v-model:tag-filter="selectedTagNames"
      :characters
    />

    <div class="characters">
      <CharacterIcon
        v-for="character in filteredCharacters"
        :key="character.id"
        :character="{ ...character, team: selectedTeam }"
        :isDraggable
        :isPlaced="isCharacterPlaced(character.id)"
        :selected-filter="selectedTagNames"
        @character-click="handleCharacterClick"
      />
    </div>
  </div>
</template>

<style scoped>
.character-selection {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  min-height: 656px;
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

.characters {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-lg);
  justify-content: flex-start;
  align-content: flex-start;
  padding: var(--spacing-lg);
  border-radius: var(--radius-large);
}

@media (max-width: 768px) {
  .characters {
    padding: var(--spacing-md);
    justify-content: center;
  }
}

@media (max-width: 480px) {
  .characters {
    gap: var(--spacing-sm);
    padding: var(--spacing-sm);
    justify-content: center;
  }
}
</style>

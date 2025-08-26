<script setup lang="ts">
import { computed, ref } from 'vue'

import CharacterFilters from './CharacterFilters.vue'
import CharacterIcon from './CharacterIcon.vue'
import SelectionContainer from './ui/SelectionContainer.vue'
import { useSelectionState } from '../composables/useSelectionState'
import type { CharacterType } from '../lib/types/character'

const props = defineProps<{
  characters: readonly CharacterType[]
  isDraggable?: boolean
}>()

const { selectedTeam, characterStore } = useSelectionState()

// Filter state
const factionFilter = ref('')
const classFilter = ref('')
const damageFilter = ref('')

// Filtered and sorted characters
const filteredAndSortedCharacters = computed(() => {
  let filtered = [...props.characters]

  // Apply filters
  if (factionFilter.value) {
    filtered = filtered.filter((char) => char.faction === factionFilter.value)
  }
  if (classFilter.value) {
    filtered = filtered.filter((char) => char.class === classFilter.value)
  }
  if (damageFilter.value) {
    filtered = filtered.filter((char) => char.damage === damageFilter.value)
  }

  // Sort filtered results
  return filtered.sort(
    (a, b) =>
      a.faction.localeCompare(b.faction) ||
      a.class.localeCompare(b.class) ||
      a.name.localeCompare(b.name),
  )
})

const isCharacterPlaced = (characterId: number): boolean => {
  // Get all tiles with characters
  const tilesWithCharacters = characterStore.getTilesWithCharacters()

  // Check if this character is placed for the current selected team
  return tilesWithCharacters.some(
    (tile) => tile.characterId === characterId && tile.team === selectedTeam.value,
  )
}

const handleCharacterClick = (character: CharacterType) => {
  // Check if character is already placed for current team
  if (isCharacterPlaced(character.id)) {
    removeCharacterFromGrid(character.id)
    return
  }

  // Attempt to auto-place the character
  characterStore.autoPlaceCharacter(character.id, selectedTeam.value)
}

const removeCharacterFromGrid = (characterId: number) => {
  // Find the hex where this character is placed for the current team
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
  <SelectionContainer
    containerClass="character-selection"
    :showCounts="true"
    :allyCount="characterStore.availableAlly"
    :enemyCount="characterStore.availableEnemy"
    :maxAllyCount="characterStore.maxTeamSizeAlly"
    :maxEnemyCount="characterStore.maxTeamSizeEnemy"
    :showFilters="true"
  >
    <!-- Character Filters in Controls Row -->
    <template #filters>
      <CharacterFilters
        :characters
        :factionFilter
        :classFilter
        :damageFilter
        @update:factionFilter="factionFilter = $event"
        @update:classFilter="classFilter = $event"
        @update:damageFilter="damageFilter = $event"
      />
    </template>

    <!-- Characters Grid -->
    <div class="characters">
      <CharacterIcon
        v-for="character in filteredAndSortedCharacters"
        :key="character.id"
        :character="{ ...character, team: selectedTeam }"
        :isDraggable
        :isPlaced="isCharacterPlaced(character.id)"
        @character-click="handleCharacterClick"
      />
    </div>
  </SelectionContainer>
</template>

<style scoped>
.character-selection {
  display: flex;
  flex-direction: column;
  min-height: 652px;
  max-height: 652px;
  overflow-y: auto;
}

/* Add scroll for large screens when in side-by-side layout */
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

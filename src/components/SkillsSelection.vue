<script setup lang="ts">
import { computed } from 'vue'

import type { CharacterType } from '../lib/types/character'
import { useSelectionState } from '../composables/useSelectionState'
import Character from './Character.vue'
import SelectionContainer from './SelectionContainer.vue'

const props = defineProps<{
  characters: readonly CharacterType[]
  characterImages: Readonly<Record<string, string>>
  icons: Readonly<Record<string, string>>
  isDraggable?: boolean
}>()

// List of characters that have skill implementations
// Single source of truth - add more character names here as skills are implemented
const SKILL_CHARACTERS = ['silvina', 'vala', 'reinier'] as const

const { selectedTeam, characterStore } = useSelectionState()

// Filter characters to only show those with skills
const skillCharacters = computed(() => {
  return props.characters
    .filter((char) => SKILL_CHARACTERS.includes(char.name as any))
    .sort((a, b) => {
      // Sort by the order in SKILL_CHARACTERS array
      const aIndex = SKILL_CHARACTERS.indexOf(a.name as any)
      const bIndex = SKILL_CHARACTERS.indexOf(b.name as any)
      return aIndex - bIndex
    })
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
    containerClass="skills-selection"
    :showCounts="true"
    :allyCount="characterStore.availableAlly"
    :enemyCount="characterStore.availableEnemy"
    :maxAllyCount="characterStore.maxTeamSizeAlly"
    :maxEnemyCount="characterStore.maxTeamSizeEnemy"
  >
    <!-- Skills Characters Grid -->
    <div class="characters">
      <Character
        v-for="character in skillCharacters"
        :key="character.id"
        :character="{ ...character, team: selectedTeam }"
        :characterImage="characterImages[character.name]"
        :icons="icons"
        :isDraggable="isDraggable"
        :isPlaced="isCharacterPlaced(character.id)"
        @character-click="handleCharacterClick"
      />
    </div>
  </SelectionContainer>
</template>

<style scoped>
.skills-selection {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}

.characters {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-2xl);
  justify-content: flex-start;
  padding: var(--spacing-lg);
  border-radius: var(--radius-large);
}

/* Add scroll for large screens when in side-by-side layout */
@media (min-width: 1281px) {
  .characters {
    min-height: 496px;
    height: 496px;
    overflow-y: auto;
  }
}

@media (min-width: 1540px) {
  .characters {
    min-height: 544px;
    height: 544px;
  }
}

@media (min-width: 1892px) {
  .characters {
    min-height: 596px;
    height: 596px;
  }
}

/* Responsive styles */
@media (max-width: 768px) {
  .characters {
    gap: var(--spacing-lg);
    padding: var(--spacing-md);
  }
}

@media (max-width: 480px) {
  .skills-selection {
    gap: var(--spacing-sm);
  }

  .characters {
    gap: var(--spacing-md);
    padding: var(--spacing-sm);
  }
}
</style>

<script setup lang="ts">
import { computed, ref } from 'vue'

import type { CharacterType } from '../lib/types/character'
import { useSelectionState } from '../composables/useSelectionState'
import { useI18nStore } from '../stores/i18n'
import Character from './Character.vue'
import ReinierSkillModal from './modals/ReinierSkillModal.vue'
import SelectionContainer from './SelectionContainer.vue'
import SilvinaSkillModal from './modals/SilvinaSkillModal.vue'
import ValaSkillModal from './modals/ValaSkillModal.vue'

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
const i18n = useI18nStore()

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

// Modal states for each character
const showSilvinaModal = ref(false)
const showValaModal = ref(false)
const showReinierModal = ref(false)

const openDetailsModal = (character: CharacterType) => {
  switch (character.name) {
    case 'silvina':
      showSilvinaModal.value = true
      break
    case 'vala':
      showValaModal.value = true
      break
    case 'reinier':
      showReinierModal.value = true
      break
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
      <div v-for="character in skillCharacters" :key="character.id" class="character-wrapper">
        <Character
          :character="{ ...character, team: selectedTeam }"
          :characterImage="characterImages[character.name]"
          :icons="icons"
          :isDraggable="isDraggable"
          :isPlaced="isCharacterPlaced(character.id)"
          @character-click="handleCharacterClick"
        />
        <button
          @click="openDetailsModal(character)"
          class="details-button"
          title="View skill details"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle cx="8" cy="8" r="7" stroke="white" stroke-width="1.5" />
            <circle cx="8" cy="5" r="0.5" fill="white" />
            <path d="M8 7V12" stroke="white" stroke-width="1.5" stroke-linecap="round" />
          </svg>
          {{ i18n.t('app.details') }}
        </button>
      </div>
    </div>

    <!-- Skill Detail Modals -->
    <SilvinaSkillModal :show="showSilvinaModal" @close="showSilvinaModal = false" />
    <ValaSkillModal :show="showValaModal" @close="showValaModal = false" />
    <ReinierSkillModal :show="showReinierModal" @close="showReinierModal = false" />
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

.character-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-sm);
}

.details-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 4px 8px;
  background: var(--color-primary);
  color: white;
  border: 2px solid var(--color-primary);
  border-radius: var(--radius-medium);
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.details-button:hover {
  background: var(--color-primary-hover);
  border-color: var(--color-primary-hover);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.details-button svg {
  width: 16px;
  height: 16px;
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

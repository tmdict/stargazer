<script setup lang="ts">
import { computed, ref } from 'vue'

import { useSelectionState } from '../composables/useSelectionState'
import type { CharacterType } from '../lib/types/character'
import { useI18nStore } from '../stores/i18n'
import Character from './Character.vue'
import SkillModal from './modals/SkillModal.vue'
import IconInfo from './ui/IconInfo.vue'
import SelectionContainer from './ui/SelectionContainer.vue'

const props = defineProps<{
  characters: readonly CharacterType[]
  characterImages: Readonly<Record<string, string>>
  icons: Readonly<Record<string, string>>
  isDraggable?: boolean
}>()

// List of characters that have skill implementations
// Single source of truth - add more character names here as skills are implemented
const SKILL_CHARACTERS = ['silvina', 'nara', 'vala', 'reinier', 'dunlingr'] as const

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

// Modal state - single modal for all skills
const showSkillModal = ref(false)
const selectedSkillName = ref('')

const openDetailsModal = (character: CharacterType) => {
  // Capitalize first letter for proper filename
  selectedSkillName.value = character.name.charAt(0).toUpperCase() + character.name.slice(1)
  showSkillModal.value = true
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
          :icons
          :isDraggable
          :isPlaced="isCharacterPlaced(character.id)"
          @character-click="handleCharacterClick"
        />
        <button
          @click="openDetailsModal(character)"
          class="details-button"
          title="View skill details"
        >
          <IconInfo :size="14" />
          {{ i18n.t('app.info') }}
        </button>
      </div>
    </div>

    <!-- Skill Modal -->
    <SkillModal
      :show="showSkillModal"
      :skill-name="selectedSkillName"
      @close="showSkillModal = false"
    />
  </SelectionContainer>
</template>

<style scoped>
.skills-selection {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  min-height: 656px;
  max-height: 656px;
  overflow-y: auto;
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
  width: 75px;
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

<script setup lang="ts">
import { computed, ref } from 'vue'

import CharacterIcon from './CharacterIcon.vue'
import SkillModal from './modals/SkillModal.vue'
import TagsDisplay from './TagsDisplay.vue'
import IconInfo from './ui/IconInfo.vue'
import SelectionContainer from './ui/SelectionContainer.vue'
import { useSelectionState } from '@/composables/useSelectionState'
import { DOCUMENTED_SKILLS } from '@/content/skill'
import type { CharacterType } from '@/lib/types/character'
import { useI18nStore } from '@/stores/i18n'

const props = defineProps<{
  characters: readonly CharacterType[]
  isDraggable?: boolean
}>()

const { selectedTeam, characterStore } = useSelectionState()
const i18n = useI18nStore()

// Filter state
const selectedTagNames = ref<string | null>(null)

// Filter characters to only show those with skills
const skillCharacters = computed(() => {
  let filtered = props.characters.filter((char) => DOCUMENTED_SKILLS.includes(char.name))

  // Apply tag filters
  if (selectedTagNames.value) {
    filtered = filtered.filter((char) => char.tags.includes(selectedTagNames.value!))
  }

  // Sort by the order in DOCUMENTED_SKILLS array
  return filtered.sort((a, b) => {
    const aIndex = DOCUMENTED_SKILLS.indexOf(a.name)
    const bIndex = DOCUMENTED_SKILLS.indexOf(b.name)
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

const clearFilters = () => {
  selectedTagNames.value = null
}

// Modal state - single modal for all skills
const showSkillModal = ref(false)
const selectedSkillName = ref('')

const openDetailsModal = (character: CharacterType) => {
  selectedSkillName.value = character.name
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
    :showFilters="true"
    @clear-filters="clearFilters"
  >
    <!-- Tags Display -->
    <TagsDisplay v-model="selectedTagNames" :characters />

    <!-- Skills Characters Grid -->
    <div class="characters">
      <div v-for="character in skillCharacters" :key="character.id" class="character-wrapper">
        <CharacterIcon
          :character="{ ...character, team: selectedTeam }"
          :isDraggable
          :isPlaced="isCharacterPlaced(character.id)"
          :hideInfo="true"
          :selected-filter="selectedTagNames"
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
  margin-top: 6px;
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

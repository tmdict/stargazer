<script setup lang="ts">
import { computed, ref } from 'vue'

import CharacterIcon from './CharacterIcon.vue'
import SkillModal from './modals/SkillModal.vue'
import TagsDisplay from './TagsDisplay.vue'
import FilterIcons from './ui/FilterIcons.vue'
import IconInfo from './ui/IconInfo.vue'
import { useSelectionState } from '@/composables/useSelectionState'
import { compareFaction } from '@/lib/filterOrder'
import type { CharacterType } from '@/lib/types/character'
import { useI18nStore } from '@/stores/i18n'
import { hasSkillLocale } from '@/utils/dataLoader'

const props = defineProps<{
  characters: readonly CharacterType[]
  isDraggable?: boolean
}>()

const { selectedTeam, characterStore } = useSelectionState()
const i18n = useI18nStore()

// Filter state
const factionFilter = ref('')
const classFilter = ref('')
const damageFilter = ref('')
const selectedTagNames = ref<string | null>(null)

const factionOptions = computed(() => [...new Set(props.characters.map((c) => c.faction))].sort())
const classOptions = computed(() => [...new Set(props.characters.map((c) => c.class))].sort())
const damageOptions = computed(() => [...new Set(props.characters.map((c) => c.damage))].sort())

const skillCharacters = computed(() => {
  let filtered = [...props.characters]

  if (factionFilter.value) {
    filtered = filtered.filter((char) => char.faction === factionFilter.value)
  }
  if (classFilter.value) {
    filtered = filtered.filter((char) => char.class === classFilter.value)
  }
  if (damageFilter.value) {
    filtered = filtered.filter((char) => char.damage === damageFilter.value)
  }
  if (selectedTagNames.value) {
    filtered = filtered.filter((char) => Object.keys(char.tags).includes(selectedTagNames.value!))
  }

  return filtered.sort((a, b) => compareFaction(a.faction, b.faction) || a.id - b.id)
})

const hasDocumentedSkill = (name: string): boolean => hasSkillLocale(name)

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
  selectedSkillName.value = character.name
  showSkillModal.value = true
}
</script>

<template>
  <div class="skills-selection">
    <!-- Faction / Class / Damage filters -->
    <div class="filters-row">
      <FilterIcons
        v-model="factionFilter"
        icon-prefix="faction"
        :options="factionOptions"
        active-border-color="var(--color-primary)"
      />
      <FilterIcons
        v-model="classFilter"
        icon-prefix="class"
        :options="classOptions"
        active-border-color="var(--color-primary)"
      />
      <FilterIcons
        v-model="damageFilter"
        icon-prefix="damage"
        :options="damageOptions"
        active-border-color="var(--color-primary)"
      />
    </div>

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
          v-if="hasDocumentedSkill(character.name)"
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
      :initial-chip="selectedTagNames"
      @close="showSkillModal = false"
    />
  </div>
</template>

<style scoped>
.filters-row {
  display: flex;
  gap: var(--spacing-md);
  align-items: end;
  flex-wrap: wrap;
}

@media (max-width: 768px) {
  .filters-row {
    gap: var(--spacing-sm);
    flex-direction: column;
    align-items: stretch;
  }
}

.skills-selection {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  min-height: 656px;
}

/* See CharacterSelection.vue — wide-screen flex-fill with own scroll, narrow
   stacks naturally. */
@media (min-width: 1220px) {
  .skills-selection {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }
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

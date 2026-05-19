<script setup lang="ts">
import { computed, ref } from 'vue'

import CharacterIcon from './CharacterIcon.vue'
import FilterIcons from './ui/FilterIcons.vue'
import { useOverlay } from '@/composables/useOverlay'
import { canPlaceCharacterOnTeam } from '@/lib/characters/character'
import type { Hex } from '@/lib/hex'
import type { CharacterType } from '@/lib/types/character'
import { useCharacterStore } from '@/stores/character'
import { useGridStore } from '@/stores/grid'
import { getTeamFromTileState } from '@/utils/tileStateFormatting'

interface Props {
  hex: Hex
  characters: readonly CharacterType[]
  position: { x: number; y: number }
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
}>()

const characterStore = useCharacterStore()
const gridStore = useGridStore()
const modalRef = ref<HTMLElement>()

const team = computed(() => {
  const tile = gridStore.getTile(props.hex.getId())
  return getTeamFromTileState(tile.state)
})

const availableCharacters = computed(() => {
  if (!team.value) return []

  const tilesWithCharacters = characterStore.getTilesWithCharacters()
  const placedCharacterIds = tilesWithCharacters
    .filter((tile) => tile.team === team.value)
    .map((tile) => tile.characterId)

  return props.characters
    .filter((char) => !placedCharacterIds.includes(char.id))
    .sort((a, b) => a.faction.localeCompare(b.faction) || a.name.localeCompare(b.name))
})

// Faction filter composes on top of availableCharacters (which excludes
// already-placed heroes), so options/count reflect the remaining pool.
const factionFilter = ref('')
const factionOptions = computed(() =>
  [...new Set(availableCharacters.value.map((c) => c.faction))].sort(),
)
const filteredCharacters = computed(() =>
  factionFilter.value
    ? availableCharacters.value.filter((c) => c.faction === factionFilter.value)
    : availableCharacters.value,
)

const handleCharacterClick = (character: CharacterType) => {
  if (!team.value) return

  if (!canPlaceCharacterOnTeam(gridStore._getGrid(), character.id, team.value)) {
    return
  }

  const success = characterStore.placeCharacterOnHex(props.hex.getId(), character.id, team.value)
  if (success) {
    emit('close')
  }
}

const handleMouseLeave = () => {
  emit('close')
}

useOverlay({
  elementRef: modalRef,
  onClose: () => emit('close'),
  clickOutsideDelay: 100,
})
</script>

<template>
  <div
    ref="modalRef"
    class="character-selection-modal"
    :style="{
      left: `${position.x}px`,
      top: `${position.y}px`,
    }"
    @mouseleave="handleMouseLeave"
  >
    <div class="filter-row">
      <FilterIcons
        v-model="factionFilter"
        icon-prefix="faction"
        :options="factionOptions"
        :size="28"
        :show-tooltip="false"
      />
    </div>
    <div class="characters-grid">
      <div
        v-for="character in filteredCharacters"
        :key="character.id"
        class="character-item"
        @click="handleCharacterClick(character)"
      >
        <CharacterIcon :character="character" :isDraggable="false" :showSimpleTooltip="true" />
      </div>
      <div v-if="filteredCharacters.length === 0" class="no-characters">
        No available characters
      </div>
    </div>
  </div>
</template>

<style scoped>
.character-selection-modal {
  position: fixed;
  background: rgba(20, 20, 20, 0.8);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 10px;
  box-shadow:
    0 10px 30px rgba(0, 0, 0, 0.5),
    0 0 0 1px rgba(255, 255, 255, 0.05) inset;
  z-index: 1000;
  max-width: 320px;
  max-height: 380px;
}

.filter-row {
  margin-bottom: 8px;
}

/* FilterIcons defaults to --color-text-secondary (dark gray), which disappears
   on this modal's dark backdrop. Override the "All" button color for legibility. */
.filter-row :deep(.clear-option) {
  color: rgba(255, 255, 255, 0.75);
}

.characters-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 5px;
  overflow-y: auto;
  max-height: 280px;
}

.characters-grid::-webkit-scrollbar {
  width: 4px;
}

.characters-grid::-webkit-scrollbar-track {
  background: transparent;
}

.characters-grid::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
}

.characters-grid::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}

.character-item {
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 2px;
  border-radius: 4px;
  transition: all 0.15s ease;
}

.character-item:hover {
  transform: scale(1.1);
  filter: brightness(1.2);
}

.character-item :deep(.character-display) {
  width: 45px !important;
  height: 45px !important;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.2) !important;
}

.character-item :deep(.portrait) {
  width: 50px !important;
  height: 50px !important;
}

.character-item :deep(.character-info) {
  display: none !important;
}

.no-characters {
  grid-column: 1 / -1;
  text-align: center;
  color: rgba(255, 255, 255, 0.6);
  padding: 20px;
  font-size: 14px;
}
</style>

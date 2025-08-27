<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

import CharacterIcon from './CharacterIcon.vue'
import { canPlaceCharacterOnTeam } from '../lib/character'
import type { Hex } from '../lib/hex'
import type { CharacterType } from '../lib/types/character'
import { State } from '../lib/types/state'
import { Team } from '../lib/types/team'
import { useCharacterStore } from '../stores/character'
import { useGridStore } from '../stores/grid'

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
  const state = tile.state

  if (state === State.AVAILABLE_ALLY || state === State.OCCUPIED_ALLY) {
    return Team.ALLY
  } else if (state === State.AVAILABLE_ENEMY || state === State.OCCUPIED_ENEMY) {
    return Team.ENEMY
  }
  return null
})

const availableCharacters = computed(() => {
  if (!team.value) return []

  const tilesWithCharacters = characterStore.getTilesWithCharacters()
  const placedCharacterIds = tilesWithCharacters
    .filter((tile) => tile.team === team.value)
    .map((tile) => tile.characterId)

  return props.characters
    .filter((char) => !placedCharacterIds.includes(char.id))
    .sort((a, b) => {
      // First sort by faction
      const factionCompare = a.faction.localeCompare(b.faction)
      if (factionCompare !== 0) return factionCompare

      // Then sort by name within the same faction
      return a.name.localeCompare(b.name)
    })
})

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

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    emit('close')
  }
}

const handleClickOutside = (event: MouseEvent) => {
  if (modalRef.value && event.target instanceof Node && !modalRef.value.contains(event.target)) {
    emit('close')
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
  // Add click listener with a small delay to avoid closing immediately on the same click that opened it
  setTimeout(() => {
    document.addEventListener('click', handleClickOutside)
  }, 100)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  document.removeEventListener('click', handleClickOutside)
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
    <div class="characters-grid">
      <div
        v-for="character in availableCharacters"
        :key="character.id"
        class="character-item"
        @click="handleCharacterClick(character)"
      >
        <CharacterIcon :character="character" :isDraggable="false" :showSimpleTooltip="true" />
      </div>
      <div v-if="availableCharacters.length === 0" class="no-characters">
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
  max-height: 340px;
}

.characters-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 5px;
  overflow-y: auto;
  max-height: 320px;
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

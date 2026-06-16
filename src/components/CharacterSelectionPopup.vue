<script setup lang="ts">
import { computed, ref } from 'vue'

import CharacterIcon from './CharacterIcon.vue'
import FilterIcons from './ui/FilterIcons.vue'
import SelectionPopup from './ui/SelectionPopup.vue'
import { canPlaceCharacterOnTeam } from '@/lib/characters/character'
import { compareFaction } from '@/lib/filterOrder'
import type { Hex } from '@/lib/hex'
import type { CharacterType } from '@/lib/types/character'
import { useCharacterStore } from '@/stores/character'
import { useGridStore } from '@/stores/grid'
import { useGrids } from '@/stores/grids'
import { getTeamFromTileState } from '@/utils/tileStateFormatting'

interface Props {
  // The tapped tile — determines the team and where the chosen hero is placed.
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
const grids = useGrids()

const team = computed(() => getTeamFromTileState(gridStore.getTile(props.hex.getId()).state))

// Heroes not already on this team on any board (page-wide uniqueness; on the
// single Arena board this is just the one board).
const availableCharacters = computed(() => {
  const t = team.value
  if (!t) return []
  return props.characters.filter((char) => !grids.isUsed(char.id, t))
})

// Match the main roster's order (CharacterSelection): canonical faction order, then id.
const sortedCharacters = computed(() =>
  [...availableCharacters.value].sort(
    (a, b) => compareFaction(a.faction, b.faction) || a.id - b.id,
  ),
)

// Faction filter composes on top of the available pool.
const factionFilter = ref('')
const factionOptions = computed(() =>
  [...new Set(sortedCharacters.value.map((c) => c.faction))].sort(),
)
const filteredCharacters = computed(() =>
  factionFilter.value
    ? sortedCharacters.value.filter((c) => c.faction === factionFilter.value)
    : sortedCharacters.value,
)

function handleSelect(character: CharacterType) {
  const t = team.value
  if (!t || grids.isUsed(character.id, t)) return
  if (!canPlaceCharacterOnTeam(gridStore._getGrid(), character.id, t)) return
  if (characterStore.placeCharacterOnHex(props.hex.getId(), character.id, t)) {
    emit('close')
  }
}
</script>

<template>
  <SelectionPopup :position @close="emit('close')">
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
        @click="handleSelect(character)"
      >
        <CharacterIcon :character :is-draggable="false" :show-simple-tooltip="true" />
      </div>
      <div v-if="filteredCharacters.length === 0" class="no-characters">
        No available characters
      </div>
    </div>
  </SelectionPopup>
</template>

<style scoped>
.filter-row {
  margin-bottom: 8px;
}

/* FilterIcons defaults to --color-text-secondary (dark gray), which disappears
   on this popup's dark backdrop. Override the "All" button color for legibility. */
.filter-row :deep(.clear-option) {
  color: rgba(255, 255, 255, 0.75);
}

.characters-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 5px;
  /* overflow-y:auto forces overflow-x to auto; pin it hidden so the hover
     scale-up can't add a horizontal scrollbar. Padding gives edge icons room. */
  overflow-x: hidden;
  overflow-y: auto;
  max-height: 280px;
  padding: 2px 4px;
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

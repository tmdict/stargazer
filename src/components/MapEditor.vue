/** * MapEditor Component * * Provides UI for editing hex tile states on the grid. * * Features: * -
State selection with visual previews * - Clear map button to reset all tiles to DEFAULT and remove
all characters * - Painting over any tile removes characters and replaces state entirely * - Emits
events for state selection and map clearing * * Usage: Only active when 'mapEditor' tab is selected
*/
<script setup lang="ts">
import { ref } from 'vue'

import { State } from '../lib/types/state'
import { getHexFillColor } from '../utils/stateFormatting'

const selectedState = ref<State>(State.DEFAULT)

interface StateOption {
  state: State
  label: string
}

const stateOptions: StateOption[] = [
  { state: State.DEFAULT, label: 'Empty' },
  { state: State.AVAILABLE_ALLY, label: 'Ally Tile' },
  { state: State.AVAILABLE_ENEMY, label: 'Enemy Tile' },
  { state: State.BLOCKED, label: 'Blocked' },
  { state: State.BLOCKED_BREAKABLE, label: 'Breakable' },
]

const emit = defineEmits<{
  stateSelected: [state: State]
  clearMap: []
}>()

const selectState = (state: State) => {
  selectedState.value = state
  emit('stateSelected', state)
}

const handleClearMap = () => {
  emit('clearMap')
}
</script>

<template>
  <div class="map-editor">
    <p class="editor-description">Select a tile state and click/drag on the map to paint tiles</p>

    <div class="state-options">
      <button
        v-for="option in stateOptions"
        :key="option.state"
        class="state-button"
        :class="{ active: selectedState === option.state }"
        @click="selectState(option.state)"
      >
        <div class="hex-preview">
          <svg width="60" height="60" viewBox="0 0 60 60">
            <polygon
              points="30,7 46,15 46,37 30,45 14,37 14,15"
              :fill="getHexFillColor(option.state)"
              stroke="#888888"
              stroke-width="2"
            />
          </svg>
        </div>
        <span class="state-label">{{ option.label }}</span>
      </button>
    </div>

    <div class="map-editor-actions">
      <button class="clear-button" @click="handleClearMap">Reset</button>
    </div>
  </div>
</template>

<style scoped>
.map-editor {
  padding: 1rem;
}

.editor-description {
  margin-bottom: 1rem;
  text-align: center;
}

.state-options {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  justify-content: center;
}

.state-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 0.875rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1.5px solid rgba(255, 255, 255, 0.1);
  border-radius: 0.5rem;
  cursor: pointer;
  transition: all 0.2s;
  min-width: 110px;
  max-width: 120px;
}

.state-button:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: rgba(255, 255, 255, 0.2);
  transform: translateY(-1px);
}

.state-button.active {
  border-color: #3b82f6;
  background: rgba(59, 130, 246, 0.15);
  box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.3);
}

.hex-preview {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.state-label {
  font-weight: 600;
  color: #374151;
  font-size: 0.9rem;
  text-align: center;
  line-height: 1.2;
  letter-spacing: 0.02em;
}

.map-editor-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
}

.clear-button {
  padding: 0.5rem 1.25rem;
  background: #c05b4d;
  color: white;
  border: none;
  border-radius: 0.375rem;
  font-weight: 600;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s;
}

.clear-button:hover {
  background: #b91c1c;
  transform: translateY(-1px);
}
</style>

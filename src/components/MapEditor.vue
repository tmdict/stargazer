<script setup lang="ts">
import { ref } from 'vue'

import MapInvertToggle from './MapInvertToggle.vue'
import ArenaPreviewGrid from '@/components/grid/ArenaPreviewGrid.vue'
import IconFill from '@/components/ui/IconFill.vue'
import { State } from '@/lib/types/state'
import { Team } from '@/lib/types/team'
import { useGrids } from '@/stores/grids'
import { useI18nStore } from '@/stores/i18n'
import {
  getInvertedState,
  getTeamFromTileState,
  getTileFillColor,
  invertTeam,
} from '@/utils/tileStateFormatting'

const i18n = useI18nStore()
const grids = useGrids()

const selectedState = ref<State>(State.DEFAULT)

interface StateOption {
  state: State
  labelKey: string
}

const stateOptions: StateOption[] = [
  { state: State.DEFAULT, labelKey: 'app.empty' },
  { state: State.AVAILABLE_ALLY, labelKey: 'app.ally-tile' },
  { state: State.AVAILABLE_ENEMY, labelKey: 'app.enemy-tile' },
  { state: State.BLOCKED, labelKey: 'app.blocked' },
  { state: State.BLOCKED_BREAKABLE, labelKey: 'app.breakable' },
]

// Ally/enemy tile labels follow the displayed team so they match the preview
// colour; other states keep their fixed label.
const stateLabel = (option: StateOption): string => {
  const team = getTeamFromTileState(option.state)
  if (team === null) return i18n.t(option.labelKey)
  return i18n.t(invertTeam(team, grids.inverted) === Team.ALLY ? 'app.ally-tile' : 'app.enemy-tile')
}

const emit = defineEmits<{
  stateSelected: [state: State]
  applyAllTiles: [state: State]
  resetMap: []
  arenaSelected: [mapKey: string]
}>()

const selectState = (state: State) => {
  selectedState.value = state
  emit('stateSelected', state)
}

const handleApplyAllTiles = () => {
  emit('applyAllTiles', selectedState.value)
}

const handleResetMap = () => {
  emit('resetMap')
}

const handleArenaSelected = (mapKey: string) => {
  emit('arenaSelected', mapKey)
}

const getPreviewFillColor = (state: State): string => {
  const displayState = grids.inverted ? getInvertedState(state) : state
  return getTileFillColor(displayState)
}
</script>

<template>
  <div v-scroll-chain class="map-editor">
    <section class="map-section">
      <h3 class="section-title">{{ i18n.t('app.editor') }}</h3>
      <p class="editor-description">{{ i18n.t('app.editor-tip') }}</p>

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
                :fill="getPreviewFillColor(option.state)"
                stroke="#888888"
                stroke-width="2"
              />
            </svg>
          </div>
          <span class="state-label">{{ stateLabel(option) }}</span>
        </button>
      </div>

      <div class="map-editor-actions">
        <MapInvertToggle />
        <button class="fill-button" @click="handleApplyAllTiles">
          <IconFill :size="14" /> {{ i18n.t('app.fill') }}
        </button>
        <button class="clear-button" @click="handleResetMap">{{ i18n.t('app.clear') }}</button>
      </div>
    </section>

    <section class="map-section">
      <h3 class="section-title">{{ i18n.t('app.preset') }}</h3>
      <ArenaPreviewGrid @arena-selected="handleArenaSelected" />
    </section>
  </div>
</template>

<style scoped>
.map-editor {
  padding: 1rem;
  gap: var(--spacing-lg);
  min-height: var(--panel-min-height);
}

/* See CharacterSelection.vue — wide-screen flex-fill with own scroll, narrow
   stacks naturally. */
@media (min-width: 1220px) {
  .map-editor {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }
}

.map-section + .map-section {
  margin-top: 3rem;
}

.section-title {
  margin: 0 0 var(--spacing-md);
  text-align: center;
  font-size: 0.95rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-text-secondary);
}

.map-section + .map-section .section-title {
  margin-bottom: 1.25rem;
}

.editor-description {
  margin-bottom: 1rem;
  text-align: center;
  color: #6b7280;
  letter-spacing: 0.02em;
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
  gap: 1rem;
  justify-content: center;
}

.fill-button,
.clear-button {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  cursor: pointer;
  font-family: sans-serif;
  font-size: 0.85rem;
  font-weight: 600;
  user-select: none;
  border: 2px solid;
  border-radius: var(--radius-medium);
  padding: var(--spacing-xs) var(--spacing-md);
  transition: all var(--transition-fast);
  min-height: 36px;
  flex-shrink: 0;
  white-space: nowrap;
  color: white;
}

.fill-button {
  background: var(--color-primary);
  border-color: var(--color-primary);
}

.fill-button:hover {
  background: var(--color-primary-hover);
  border-color: var(--color-primary-hover);
}

.clear-button {
  background: #c05b4d;
  border-color: #c05b4d;
}

.clear-button:hover {
  background: #b91c1c;
  border-color: #b91c1c;
}

@media (max-width: 768px) {
  .state-options {
    gap: 0.35rem;
    margin-bottom: 1rem;
  }

  .state-button {
    gap: 0.25rem;
    padding: 0.5rem;
    min-width: 0;
    max-width: none;
    flex: 1 1 0;
  }

  .hex-preview svg {
    width: 40px;
    height: 40px;
  }

  .state-label {
    font-size: 0.75rem;
  }
}
</style>

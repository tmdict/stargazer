<script setup lang="ts">
import ClearButton from '@/components/ui/ClearButton.vue'
import IconCopy from '@/components/ui/IconCopy.vue'
import IconDownload from '@/components/ui/IconDownload.vue'
import IconLink from '@/components/ui/IconLink.vue'
import TeamToggle from '@/components/ui/TeamToggle.vue'
import { useSelectionState } from '@/composables/useSelectionState'
import { useI18nStore } from '@/stores/i18n'

const i18n = useI18nStore()
const { selectedTeam, characterStore, handleTeamChange, handleClearAll } = useSelectionState()

defineProps<{
  showArrows: boolean
  showHexIds: boolean
  showPerspective: boolean
  showSkills?: boolean
  teamView?: boolean
  // When true, the Team View toggle is hidden (e.g. Map Editor and Debug tabs).
  hideTeamView?: boolean
  // Hides the Ally/Enemy toggle and Clear (Map Editor / Debug don't place characters).
  hideTeamControls?: boolean
}>()

const emit = defineEmits<{
  'update:showArrows': [value: boolean]
  'update:showHexIds': [value: boolean]
  'update:showPerspective': [value: boolean]
  'update:showSkills': [value: boolean]
  'update:teamView': [value: boolean]
  copyLink: []
  copyImage: []
  download: []
}>()

const handleArrowsChange = (event: Event) => {
  if (!(event.target instanceof HTMLInputElement)) return
  emit('update:showArrows', event.target.checked)
}

const handleHexIdsChange = (event: Event) => {
  if (!(event.target instanceof HTMLInputElement)) return
  emit('update:showHexIds', event.target.checked)
}

const handlePerspectiveChange = (event: Event) => {
  if (!(event.target instanceof HTMLInputElement)) return
  emit('update:showPerspective', !event.target.checked) // Invert logic: checked = flat = showPerspective false
}

const handleSkillsChange = (event: Event) => {
  if (!(event.target instanceof HTMLInputElement)) return
  emit('update:showSkills', event.target.checked)
}

const handleTeamViewChange = (event: Event) => {
  if (!(event.target instanceof HTMLInputElement)) return
  emit('update:teamView', event.target.checked)
}

const handleCopyLink = () => {
  emit('copyLink')
}

const handleCopyImage = () => {
  emit('copyImage')
}

const handleDownload = () => {
  emit('download')
}
</script>

<template>
  <div class="grid-controls">
    <!-- Row 1: grid display toggles -->
    <div class="controls-row">
      <label class="grid-toggle-btn" :class="{ active: !showPerspective }">
        <input
          type="checkbox"
          :checked="!showPerspective"
          @change="handlePerspectiveChange"
          class="grid-toggle-checkbox"
        />
        <span class="grid-toggle-text">{{ i18n.t('app.flat') }}</span>
      </label>
      <label class="grid-toggle-btn" :class="{ active: showHexIds }">
        <input
          type="checkbox"
          :checked="showHexIds"
          @change="handleHexIdsChange"
          class="grid-toggle-checkbox"
        />
        <span class="grid-toggle-text">{{ i18n.t('app.grid-info') }}</span>
      </label>
      <label v-if="!hideTeamView" class="grid-toggle-btn" :class="{ active: teamView }">
        <input
          type="checkbox"
          :checked="teamView"
          @change="handleTeamViewChange"
          class="grid-toggle-checkbox"
        />
        <span class="grid-toggle-text">{{ i18n.t('app.team-view') }}</span>
      </label>
      <label class="grid-toggle-btn" :class="{ active: showSkills, disabled: teamView }">
        <input
          type="checkbox"
          :checked="showSkills"
          :disabled="teamView"
          @change="handleSkillsChange"
          class="grid-toggle-checkbox"
        />
        <span class="grid-toggle-text">{{ i18n.t('app.skills') }}</span>
      </label>
      <label class="grid-toggle-btn" :class="{ active: showArrows, disabled: teamView }">
        <input
          type="checkbox"
          :checked="showArrows"
          :disabled="teamView"
          @change="handleArrowsChange"
          class="grid-toggle-checkbox"
        />
        <span class="grid-toggle-text">{{ i18n.t('app.targeting') }}</span>
      </label>
    </div>

    <!-- Row 2: team toggle + action buttons + clear -->
    <div class="controls-row">
      <TeamToggle
        v-if="!hideTeamControls"
        :selectedTeam
        :showCounts="showHexIds"
        :allyCount="characterStore.availableAlly"
        :enemyCount="characterStore.availableEnemy"
        :maxAllyCount="characterStore.maxTeamSizeAlly"
        :maxEnemyCount="characterStore.maxTeamSizeEnemy"
        @team-change="handleTeamChange"
      />
      <button @click="handleCopyLink" class="action-btn" :title="i18n.t('app.link')">
        <IconLink :size="14" class="btn-icon" />
        <span class="btn-text">{{ i18n.t('app.link') }}</span>
      </button>
      <button @click="handleCopyImage" class="action-btn" :title="i18n.t('app.copy')">
        <IconCopy :size="14" class="btn-icon" />
        <span class="btn-text">{{ i18n.t('app.copy') }}</span>
      </button>
      <button @click="handleDownload" class="action-btn" :title="i18n.t('app.download')">
        <IconDownload :size="14" class="btn-icon" />
        <span class="btn-text">{{ i18n.t('app.download') }}</span>
      </button>
      <ClearButton v-if="!hideTeamControls" @click="handleClearAll" />
    </div>
  </div>
</template>

<style scoped>
.grid-controls {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
  margin-top: var(--spacing-lg);
}

.controls-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: var(--spacing-lg);
}

/* Base button styles shared by all control buttons */
.grid-toggle-btn,
.action-btn {
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
}

/* Toggle button specific styles */
.grid-toggle-btn {
  color: var(--color-text-secondary);
  background: var(--color-bg-primary);
  border-color: var(--color-border-primary);
  padding: var(--spacing-sm) var(--spacing-md);
}

.grid-toggle-btn:hover {
  background: var(--color-bg-tertiary);
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.grid-toggle-btn.disabled {
  opacity: 0.45;
  cursor: not-allowed;
  pointer-events: none;
}

/* Action button specific styles */
.action-btn {
  background: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}

.action-btn:hover {
  background: var(--color-primary-hover);
  border-color: var(--color-primary-hover);
}

.action-btn:active {
  transform: scale(0.95);
}

/* Checkbox inside toggle buttons */
.grid-toggle-checkbox {
  width: 0.9rem;
  height: 0.9rem;
  cursor: pointer;
  accent-color: var(--color-primary);
  margin: 0;
}

/* Text elements in buttons */
.grid-toggle-text {
  font-weight: 600;
}

.btn-icon {
  flex-shrink: 0;
}

/* Mobile: a native-first toolbar — display toggles become filled/outlined
   choice chips (the fill is the on/off state, so the checkbox is dropped) and
   the link/copy/download actions become icon-only round buttons. */
@media (max-width: 768px) {
  .grid-controls {
    gap: var(--spacing-sm);
  }
  .controls-row {
    gap: 6px;
  }
  /* Row 2 (team toggle + action buttons) breathes more; row 1's chips stay
     tight so they don't re-wrap. */
  .controls-row:last-child {
    gap: 12px;
  }

  .grid-toggle-btn {
    border-radius: 999px;
    border-width: 1px;
    border-color: var(--color-border-primary);
    background: var(--color-bg-secondary);
    color: var(--color-text-secondary);
    padding: 5px 11px;
    min-height: 0;
    gap: 0;
    font-size: 0.78rem;
    font-weight: 500;
  }
  .grid-toggle-btn.active {
    background: var(--color-primary);
    border-color: var(--color-primary);
    color: #fff;
  }
  .grid-toggle-checkbox {
    display: none;
  }

  .action-btn {
    border-radius: 999px;
    padding: 0;
    width: 40px;
    height: 40px;
    min-height: 0;
    justify-content: center;
  }
  .action-btn .btn-text {
    display: none;
  }
  .action-btn .btn-icon {
    width: 18px;
    height: 18px;
  }
}

@media (max-width: 480px) {
  .controls-row {
    gap: 5px;
  }
  .controls-row:last-child {
    gap: 10px;
  }
  .grid-toggle-btn {
    padding: 4px 10px;
    font-size: 0.74rem;
  }
  .action-btn {
    width: 36px;
    height: 36px;
  }
  .action-btn .btn-icon {
    width: 16px;
    height: 16px;
  }
}
</style>

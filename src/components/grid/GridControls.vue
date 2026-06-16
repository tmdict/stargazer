<script setup lang="ts">
import { computed } from 'vue'

import ClearButton from '@/components/ui/ClearButton.vue'
import IconCopy from '@/components/ui/IconCopy.vue'
import IconDownload from '@/components/ui/IconDownload.vue'
import IconLink from '@/components/ui/IconLink.vue'
import TeamToggle from '@/components/ui/TeamToggle.vue'
import { useSelectionState } from '@/composables/useSelectionState'
import { useI18nStore } from '@/stores/i18n'

const i18n = useI18nStore()
const { selectedTeam, characterStore, handleTeamChange, handleClearAll } = useSelectionState()

const showArrows = defineModel<boolean>('showArrows', { required: true })
const showHexIds = defineModel<boolean>('showHexIds', { required: true })
const showPerspective = defineModel<boolean>('showPerspective', { required: true })
const showSkills = defineModel<boolean>('showSkills')
const teamView = defineModel<boolean>('teamView')

defineProps<{
  // When true, the Team View toggle is hidden (e.g. Map Editor and Debug tabs).
  hideTeamView?: boolean
  // Hides the Ally/Enemy toggle and Clear (Map Editor / Debug don't place characters).
  hideTeamControls?: boolean
  // Lay every control out in one wrapping row (the wide 5 v 5 page) instead of
  // the default two stacked rows.
  singleRow?: boolean
}>()

const emit = defineEmits<{
  copyLink: []
  copyImage: []
  download: []
}>()

// The toggle presents the inverse: checked = flat = perspective off
const flatView = computed({
  get: () => !showPerspective.value,
  set: (flat) => (showPerspective.value = !flat),
})
</script>

<template>
  <div class="grid-controls" :class="{ 'single-row': singleRow }">
    <!-- Row 1: grid display toggles -->
    <div class="controls-row">
      <label class="grid-toggle-btn" :class="{ active: flatView }">
        <input type="checkbox" v-model="flatView" class="grid-toggle-checkbox" />
        <span class="grid-toggle-text">{{ i18n.t('app.flat') }}</span>
      </label>
      <label class="grid-toggle-btn" :class="{ active: showHexIds }">
        <input type="checkbox" v-model="showHexIds" class="grid-toggle-checkbox" />
        <span class="grid-toggle-text">{{ i18n.t('app.grid-info') }}</span>
      </label>
      <label v-if="!hideTeamView" class="grid-toggle-btn" :class="{ active: teamView }">
        <input type="checkbox" v-model="teamView" class="grid-toggle-checkbox" />
        <span class="grid-toggle-text">{{ i18n.t('app.team-view') }}</span>
      </label>
      <label class="grid-toggle-btn" :class="{ active: showSkills, disabled: teamView }">
        <input
          type="checkbox"
          v-model="showSkills"
          :disabled="teamView"
          class="grid-toggle-checkbox"
        />
        <span class="grid-toggle-text">{{ i18n.t('app.skills') }}</span>
      </label>
      <label class="grid-toggle-btn" :class="{ active: showArrows, disabled: teamView }">
        <input
          type="checkbox"
          v-model="showArrows"
          :disabled="teamView"
          class="grid-toggle-checkbox"
        />
        <span class="grid-toggle-text">{{ i18n.t('app.targeting') }}</span>
      </label>
    </div>

    <!-- Row 2: team toggle + action buttons + clear -->
    <div class="controls-row controls-actions">
      <TeamToggle
        v-if="!hideTeamControls"
        :selected-team
        :show-counts="showHexIds"
        :ally-count="characterStore.availableAlly"
        :enemy-count="characterStore.availableEnemy"
        :max-ally-count="characterStore.maxTeamSizeAlly"
        :max-enemy-count="characterStore.maxTeamSizeEnemy"
        @team-change="handleTeamChange"
      />
      <button @click="emit('copyLink')" class="action-btn" :title="i18n.t('app.link')">
        <IconLink :size="14" class="btn-icon" />
        <span class="btn-text">{{ i18n.t('app.link') }}</span>
      </button>
      <button @click="emit('copyImage')" class="action-btn" :title="i18n.t('app.copy')">
        <IconCopy :size="14" class="btn-icon" />
        <span class="btn-text">{{ i18n.t('app.copy') }}</span>
      </button>
      <button @click="emit('download')" class="action-btn" :title="i18n.t('app.download')">
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

/* One wrapping row: flatten both rows (display: contents) so every control is a
   direct flex child laid out together. */
/* 5 v 5 sits the controls at the top of the grid card, which already has its own
   top padding, so drop the extra margin the Arena uses below its grid. */
.grid-controls.single-row {
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: center;
  gap: var(--spacing-md) var(--spacing-lg);
  margin-top: 0;
}

.grid-controls.single-row .controls-row {
  display: contents;
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
  /* The wide single-row layout reverts to the stacked two-row toolbar on mobile
     (display toggles, then team + actions + clear) — same as the Arena. */
  .grid-controls.single-row {
    flex-direction: column;
    gap: var(--spacing-sm);
  }
  .grid-controls.single-row .controls-row {
    display: flex;
  }
  .controls-row {
    gap: 6px;
  }
  /* Row 2 (team toggle + link/copy/download + clear) breathes more; row 1's
     chips stay tight so they don't re-wrap. */
  .controls-row.controls-actions {
    gap: 18px;
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
  .controls-row.controls-actions {
    gap: 16px;
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

<script setup lang="ts">
import { computed } from 'vue'

import GridInfoToggle from '@/components/grid/GridInfoToggle.vue'
import MapInvertToggle from '@/components/MapInvertToggle.vue'
import ClearButton from '@/components/ui/ClearButton.vue'
import IconCopy from '@/components/ui/IconCopy.vue'
import IconDownload from '@/components/ui/IconDownload.vue'
import IconLink from '@/components/ui/IconLink.vue'
import { useSelectionState } from '@/composables/useSelectionState'
import { useGrids } from '@/stores/grids'
import { useI18nStore } from '@/stores/i18n'

const i18n = useI18nStore()
const grids = useGrids()
const { handleClearAll, clearTargetHex, clearLiftedHex } = useSelectionState()

const showPerspective = defineModel<boolean>('showPerspective', { required: true })
const showSkills = defineModel<boolean>('showSkills')
const teamView = defineModel<boolean>('teamView')
// Boards-layout toggle, bound only by the Teams page (gated by showWrapToggle).
const wrap = defineModel<boolean>('wrap')

defineProps<{
  // When true, the Team View toggle is shown but locked (Map Editor / Debug tabs,
  // where team view doesn't apply).
  disableTeamView?: boolean
  // Hides Clear (Map Editor / Debug don't place characters).
  hideTeamControls?: boolean
  // Shows the "Wrap" boards-layout toggle (Teams only); the Arena never renders it.
  showWrapToggle?: boolean
  // Hides the Grid Info chip (map-editor painting suppresses every grid-info
  // surface, so a live-looking chip would misrepresent the board).
  hideGridInfo?: boolean
  // Shows the "Syn" friend-assist toggle (Arena team tabs; Teams 1v1 mode only).
  showSynToggle?: boolean
  // Two-step confirm on Clear (Teams only; the Arena clears instantly).
  confirmClear?: boolean
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

// Unchecking removes the placed synergy units (setSynergy), which may delete
// the unit a pending tap/lift gesture references, so the gesture state drops
// with it (every other bulk mutation clears it the same way).
const synergyView = computed({
  get: () => grids.synergy,
  set: (value: boolean) => {
    grids.setSynergy(value)
    if (!value) {
      clearTargetHex()
      clearLiftedHex()
    }
  },
})
</script>

<template>
  <div class="grid-controls">
    <!-- Row 1: grid display toggles (plus the page's own, e.g. the mode picker) -->
    <div class="controls-row">
      <slot name="toggles-start" />
      <label v-if="showWrapToggle" class="grid-toggle-btn" :class="{ active: wrap }">
        <input type="checkbox" v-model="wrap" class="grid-toggle-checkbox" />
        <span class="grid-toggle-text">{{ i18n.t('app.wrap') }}</span>
      </label>
      <GridInfoToggle v-if="!hideGridInfo" />
      <label class="grid-toggle-btn" :class="{ active: showSkills }">
        <input type="checkbox" v-model="showSkills" class="grid-toggle-checkbox" />
        <span class="grid-toggle-text">{{ i18n.t('app.skills') }}</span>
      </label>
      <label v-if="showSynToggle" class="grid-toggle-btn" :class="{ active: synergyView }">
        <input type="checkbox" v-model="synergyView" class="grid-toggle-checkbox" />
        <span class="grid-toggle-text">{{ i18n.t('app.synergy') }}</span>
      </label>
      <label class="grid-toggle-btn" :class="{ active: flatView }">
        <input type="checkbox" v-model="flatView" class="grid-toggle-checkbox" />
        <span class="grid-toggle-text">{{ i18n.t('app.flat') }}</span>
      </label>
      <MapInvertToggle />
      <label class="grid-toggle-btn" :class="{ active: teamView, disabled: disableTeamView }">
        <input
          type="checkbox"
          v-model="teamView"
          :disabled="disableTeamView"
          class="grid-toggle-checkbox"
        />
        <span class="grid-toggle-text">{{ i18n.t('app.team-view') }}</span>
      </label>
    </div>

    <!-- Row 2: action buttons (plus the page's own, e.g. team save actions) -->
    <div class="controls-row controls-actions">
      <slot name="actions-start" />
      <button @click="emit('copyLink')" class="control-btn" :title="i18n.t('app.link')">
        <IconLink :size="14" class="btn-icon" />
        <span class="btn-text">{{ i18n.t('app.link') }}</span>
      </button>
      <button @click="emit('copyImage')" class="control-btn" :title="i18n.t('app.copy')">
        <IconCopy :size="14" class="btn-icon" />
        <span class="btn-text">{{ i18n.t('app.copy') }}</span>
      </button>
      <button @click="emit('download')" class="control-btn" :title="i18n.t('app.download')">
        <IconDownload :size="14" class="btn-icon" />
        <span class="btn-text">{{ i18n.t('app.download') }}</span>
      </button>
      <ClearButton v-if="!hideTeamControls" :confirm-first="confirmClear" @click="handleClearAll" />
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

/* Sized like .control-btn (controls.css) so both rows stay 36px. */
.grid-toggle-btn {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
  user-select: none;
  border: 2px solid var(--color-border-primary);
  border-radius: var(--radius-medium);
  padding: var(--spacing-xs) var(--spacing-md);
  transition: all var(--transition-fast);
  min-height: 36px;
  flex-shrink: 0;
  white-space: nowrap;
  color: var(--color-text-secondary);
  background: var(--color-bg-primary);
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

.grid-toggle-checkbox {
  width: 0.9rem;
  height: 0.9rem;
  cursor: pointer;
  accent-color: var(--color-primary);
  margin: 0;
}

/* Touch tablets: the two-column layout (HomeView, ≥1220px) fixes the grid
   column at 660px, which fits the toggle row with little slack under desktop
   metrics — and iPadOS renders the chips' native checkboxes and text wider,
   enough to push the last chip onto a second line. Tighter gap and chip
   padding restore real headroom; MapInvertToggle and GridInfoToggle compact
   their chips on the same condition. */
@media (pointer: coarse) and (min-width: 769px) {
  .controls-row {
    gap: var(--spacing-sm);
  }
  .grid-toggle-btn {
    padding: var(--spacing-xs) var(--spacing-sm);
  }
}

/* Mobile: a native-first toolbar. Display toggles become filled/outlined
   choice chips (the fill is the on/off state, so the checkbox is dropped) and
   the link/copy/download actions become icon-only round buttons. */
@media (max-width: 768px) {
  .grid-controls {
    gap: var(--spacing-md);
  }
  .controls-row {
    gap: 6px;
  }
  /* Row 2 (link/copy/download + clear) breathes more; row 1's chips stay tight
     so they don't re-wrap. */
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
    /* Shared with the round action buttons so the rows align. */
    min-height: 34px;
    gap: 0;
    font-size: 0.78rem;
  }
  .grid-toggle-btn.active {
    background: var(--color-primary);
    border-color: var(--color-primary);
    color: #fff;
  }
  .grid-toggle-checkbox {
    display: none;
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
    min-height: 30px;
    font-size: 0.74rem;
  }
}
</style>

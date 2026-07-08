<script setup lang="ts">
import { computed } from 'vue'

import MapInvertToggle from '@/components/MapInvertToggle.vue'
import ClearButton from '@/components/ui/ClearButton.vue'
import IconCopy from '@/components/ui/IconCopy.vue'
import IconDownload from '@/components/ui/IconDownload.vue'
import IconLink from '@/components/ui/IconLink.vue'
import { useSelectionState } from '@/composables/useSelectionState'
import { useI18nStore } from '@/stores/i18n'

const i18n = useI18nStore()
const { handleClearAll } = useSelectionState()

const showArrows = defineModel<boolean>('showArrows', { required: true })
const showGridInfo = defineModel<boolean>('showGridInfo', { required: true })
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
  <div class="grid-controls">
    <!-- Row 1: grid display toggles (plus the page's own, e.g. the mode picker) -->
    <div class="controls-row">
      <slot name="toggles-start" />
      <label v-if="showWrapToggle" class="grid-toggle-btn" :class="{ active: wrap }">
        <input type="checkbox" v-model="wrap" class="grid-toggle-checkbox" />
        <span class="grid-toggle-text">{{ i18n.t('app.wrap') }}</span>
      </label>
      <label class="grid-toggle-btn" :class="{ active: flatView }">
        <input type="checkbox" v-model="flatView" class="grid-toggle-checkbox" />
        <span class="grid-toggle-text">{{ i18n.t('app.flat') }}</span>
      </label>
      <label class="grid-toggle-btn" :class="{ active: showGridInfo }">
        <input type="checkbox" v-model="showGridInfo" class="grid-toggle-checkbox" />
        <span class="grid-toggle-text">{{ i18n.t('app.grid-info') }}</span>
      </label>
      <label class="grid-toggle-btn" :class="{ active: teamView, disabled: disableTeamView }">
        <input
          type="checkbox"
          v-model="teamView"
          :disabled="disableTeamView"
          class="grid-toggle-checkbox"
        />
        <span class="grid-toggle-text">{{ i18n.t('app.team-view') }}</span>
      </label>
      <label class="grid-toggle-btn" :class="{ active: showSkills }">
        <input type="checkbox" v-model="showSkills" class="grid-toggle-checkbox" />
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
      <MapInvertToggle />
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

/* Sized like .control-btn (controls.css) so both rows stay 36px. */
.grid-toggle-btn {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  cursor: pointer;
  font-family: sans-serif;
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

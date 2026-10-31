<script setup lang="ts">
import { computed } from 'vue'

import GridInfoToggle from '@/components/grid/GridInfoToggle.vue'
import GridSkillsToggle from '@/components/grid/GridSkillsToggle.vue'
import ClearButton, { type ClearSide } from '@/components/ui/ClearButton.vue'
import IconCopy from '@/components/ui/IconCopy.vue'
import IconDownload from '@/components/ui/IconDownload.vue'
import IconLink from '@/components/ui/IconLink.vue'
import ToggleChip from '@/components/ui/ToggleChip.vue'
import { useSelectionState } from '@/composables/useSelectionState'
import { Team } from '@/lib/types/team'
import { useGrids } from '@/stores/grids'
import { useI18nStore } from '@/stores/i18n'

const i18n = useI18nStore()
const grids = useGrids()
const { handleClearAll, handleClearSide, clearTargetHex, clearLiftedHex } = useSelectionState()

const showPerspective = defineModel<boolean>('showPerspective', { required: true })
const showSkills = defineModel<boolean>('showSkills', { required: true })
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
  // Two-step confirm on Clear, whose armed step also offers clearing one side
  // (Teams only; the Arena clears instantly).
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

// Team view hides the enemy half, so its side choice goes too. The plain Clear
// still empties both sides.
const clearSides = computed((): ClearSide[] =>
  [Team.ALLY, Team.ENEMY]
    .filter((team) => team === Team.ALLY || !teamView.value)
    .map((team) => ({ team, disabled: !grids.sideHasContent(team, 'all') })),
)
</script>

<template>
  <div class="grid-controls">
    <!-- Row 1: grid display toggles (plus the page's own, e.g. the mode picker) -->
    <div class="controls-row controls-toggles">
      <slot name="toggles-start" />
      <ToggleChip v-if="showWrapToggle" v-model="wrap" :label="i18n.t('app.wrap')" />
      <GridInfoToggle v-if="!hideGridInfo" />
      <GridSkillsToggle v-model="showSkills" />
      <ToggleChip v-if="showSynToggle" v-model="synergyView" :label="i18n.t('app.syn')" />
      <ToggleChip v-model="flatView" :label="i18n.t('app.flat')" />
      <ToggleChip v-model="grids.inverted" :label="i18n.t('app.invert')" />
      <ToggleChip v-model="teamView" :disabled="disableTeamView" :label="i18n.t('app.team-view')" />
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
      <ClearButton
        v-if="!hideTeamControls"
        :confirm-first="confirmClear"
        :sides="confirmClear ? clearSides : undefined"
        @click="handleClearAll"
        @clear-side="handleClearSide"
      />
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
  gap: var(--spacing-md);
}

@media (min-width: 769px) and (max-width: 1599px) {
  .controls-row {
    gap: var(--spacing-sm);
  }
}

@media (max-width: 768px) {
  .controls-row {
    gap: 6px;
  }
  .controls-row.controls-actions {
    gap: 18px;
  }
}

@media (max-width: 480px) {
  .controls-row {
    gap: 5px;
  }
  .controls-row.controls-actions {
    gap: 7px;
  }
}

@media (max-width: 374px) {
  .controls-toggles {
    gap: 3px;
  }
}
</style>

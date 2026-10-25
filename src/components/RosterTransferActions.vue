<script setup lang="ts">
/* The roster library's file controls, as the Rosters tab and the Supreme
   League generator show them: the screenshot import, then the rosters file
   import and export. An import merges into the library and never replaces
   it. */

import RosterImportButton from './RosterImportButton.vue'
import IconDownload from '@/components/ui/IconDownload.vue'
import IconUpload from '@/components/ui/IconUpload.vue'
import TooltipPopup from '@/components/ui/TooltipPopup.vue'
import { useHoverTooltip } from '@/composables/useHoverTooltip'
import { useLibraryTransfer } from '@/composables/useLibraryTransfer'
import { useRosterFeedback } from '@/composables/useRosterFeedback'
import { useI18nStore } from '@/stores/i18n'
import { useRosters } from '@/stores/rosters'

const rosters = useRosters()
const i18n = useI18nStore()
const { report } = useRosterFeedback()

const { fileInput, download, handleFileChosen } = useLibraryTransfer({
  filePrefix: 'stargazer-rosters',
  importFile: rosters.importRosters,
  report,
  messages: {
    invalid: 'app.rosters-import-invalid',
    success: 'app.rosters-import-success',
    successConflicts: 'app.rosters-import-success-conflicts',
  },
})

const {
  anchor: tipEl,
  payload: tipKey,
  onMouseEnter: showTip,
  onMouseLeave: hideTip,
  onTouchStart: tipTouchStart,
} = useHoverTooltip<string>()
</script>

<template>
  <RosterImportButton
    @click="hideTip"
    @mouseenter="showTip($event, 'app.tooltip-roster-import')"
    @touchstart.passive="tipTouchStart"
    @mouseleave="hideTip"
  />
  <button
    type="button"
    class="control-btn compact secondary"
    :aria-label="i18n.t('app.import')"
    @click="fileInput?.click()"
    @mouseenter="showTip($event, 'app.tooltip-rosters-import')"
    @touchstart.passive="tipTouchStart"
    @mouseleave="hideTip"
  >
    <IconUpload :size="13" class="btn-icon" />
    <span class="btn-text">{{ i18n.t('app.import') }}</span>
  </button>
  <button
    v-if="rosters.count > 0"
    type="button"
    class="control-btn compact secondary"
    :aria-label="i18n.t('app.export')"
    @click="download(rosters.exportRosters())"
    @mouseenter="showTip($event, 'app.tooltip-rosters-export')"
    @touchstart.passive="tipTouchStart"
    @mouseleave="hideTip"
  >
    <IconDownload :size="13" class="btn-icon" />
    <span class="btn-text">{{ i18n.t('app.export') }}</span>
  </button>
  <input
    ref="fileInput"
    type="file"
    accept="application/json,.json"
    class="file-input"
    @change="handleFileChosen"
  />
  <Teleport to="body">
    <TooltipPopup v-if="tipKey && tipEl" :target-element="tipEl" variant="detailed">
      <template #content>{{ i18n.t(tipKey) }}</template>
    </TooltipPopup>
  </Teleport>
</template>

<style scoped>
.file-input {
  display: none;
}
</style>

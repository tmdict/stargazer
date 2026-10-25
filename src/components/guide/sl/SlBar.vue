<script setup lang="ts">
/* The generator's roster bar: the roster menu, labelled as the dock's rows
   are, the screenshot import and the rosters file import and export, as on
   the Rosters tab, then Generate. Picking or importing a roster makes it the
   active one, which the page copies. */

import RosterImportButton from '@/components/RosterImportButton.vue'
import RosterMenu from '@/components/RosterMenu.vue'
import IconDownload from '@/components/ui/IconDownload.vue'
import IconUpload from '@/components/ui/IconUpload.vue'
import TooltipPopup from '@/components/ui/TooltipPopup.vue'
import UpgradeDockLabel from '@/components/ui/UpgradeDockLabel.vue'
import { useHoverTooltip } from '@/composables/useHoverTooltip'
import { useLibraryTransfer } from '@/composables/useLibraryTransfer'
import { useToast } from '@/composables/useToast'
import { useI18nStore } from '@/stores/i18n'
import { useRosters } from '@/stores/rosters'

const { busy, ready } = defineProps<{ busy: boolean; ready: boolean }>()

const emit = defineEmits<{ generate: [] }>()

const rosters = useRosters()
const i18n = useI18nStore()
const { error, success } = useToast()

// As on the Rosters tab: an import is applied in memory even when its write
// fails, and the loss is reported in place of the success message.
const report = (message?: string): void => {
  if (!rosters.persisted) error(i18n.t('app.rosters-not-stored'))
  else if (message) success(message)
}

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
  <div class="sl-bar">
    <UpgradeDockLabel>{{ i18n.t('app.sl-roster') }}</UpgradeDockLabel>
    <RosterMenu />
    <span class="sl-bar-actions">
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
      <button
        type="button"
        class="solid-btn sl-action"
        :disabled="!ready || busy"
        :aria-busy="busy"
        @click="emit('generate')"
      >
        {{ i18n.t(busy ? 'app.sl-generating' : 'app.sl-generate') }}
      </button>
    </span>
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
  </div>
</template>

<style scoped>
.sl-bar,
.sl-bar-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
}

.file-input {
  display: none;
}

/* On a phone the roster menu takes the room the round buttons leave, so
   Generate stays on the row. A narrow phone gives the label and menu a row of
   their own, as the dock's rows are laid out there, with the buttons below
   and Generate at the end. */
@media (max-width: 768px) {
  .sl-bar :deep(.roster-menu) {
    flex: 1;
    min-width: 0;
    --dropdown-trigger-width: 100%;
    --dropdown-trigger-min-width: 0;
  }
}

@media (max-width: 480px) {
  .sl-bar {
    display: grid;
    grid-template-columns: auto 1fr;
  }
  .sl-bar-actions {
    grid-column: 2;
  }
  .sl-bar-actions .sl-action {
    margin-left: auto;
  }
}
</style>

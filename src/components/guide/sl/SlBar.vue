<script setup lang="ts">
/* The generator's roster bar: the roster menu, a rosters file import and the
   screenshot import, as on the Rosters tab, then Generate. Picking or
   importing a roster makes it the active one, which the page copies. */

import RosterImportButton from '@/components/RosterImportButton.vue'
import RosterMenu from '@/components/RosterMenu.vue'
import IconUpload from '@/components/ui/IconUpload.vue'
import TooltipPopup from '@/components/ui/TooltipPopup.vue'
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

const { fileInput, handleFileChosen } = useLibraryTransfer({
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
    <span class="sl-bar-rosters">
      <RosterMenu />
      <button
        type="button"
        class="control-btn compact"
        :aria-label="i18n.t('app.import')"
        @click="fileInput?.click()"
        @mouseenter="showTip($event, 'app.tooltip-rosters-import')"
        @touchstart.passive="tipTouchStart"
        @mouseleave="hideTip"
      >
        <IconUpload :size="13" class="btn-icon" />
        <span class="btn-text">{{ i18n.t('app.import') }}</span>
      </button>
      <RosterImportButton
        @click="hideTip"
        @mouseenter="showTip($event, 'app.tooltip-roster-import')"
        @touchstart.passive="tipTouchStart"
        @mouseleave="hideTip"
      />
      <input
        ref="fileInput"
        type="file"
        accept="application/json,.json"
        class="file-input"
        @change="handleFileChosen"
      />
    </span>
    <button
      type="button"
      class="sl-btn sl-go"
      :disabled="!ready || busy"
      :aria-busy="busy"
      @click="emit('generate')"
    >
      {{ i18n.t(busy ? 'app.sl-generating' : 'app.sl-generate') }}
    </button>

    <Teleport to="body">
      <TooltipPopup v-if="tipKey && tipEl" :target-element="tipEl" variant="detailed">
        <template #content>{{ i18n.t(tipKey) }}</template>
      </TooltipPopup>
    </Teleport>
  </div>
</template>

<style scoped>
.sl-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--spacing-sm) var(--spacing-lg);
}

.sl-bar-rosters {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
}

.file-input {
  display: none;
}
</style>

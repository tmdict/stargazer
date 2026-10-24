<script setup lang="ts">
/* The generator's roster bar: the roster menu, the screenshot import and a
   rosters file import, as on the Rosters tab, then Generate. Picking or
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
    <RosterMenu />
    <RosterImportButton
      @click="hideTip"
      @mouseenter="showTip($event, 'app.tooltip-roster-import')"
      @touchstart.passive="tipTouchStart"
      @mouseleave="hideTip"
    />
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
    <button
      type="button"
      class="solid-btn sl-go"
      :disabled="!ready || busy"
      :aria-busy="busy"
      @click="emit('generate')"
    >
      {{ i18n.t(busy ? 'app.sl-generating' : 'app.sl-generate') }}
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
  </div>
</template>

<style scoped>
.sl-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
}

/* Sized as the bar's compact buttons, and on a phone as tall as their round
   icons, keeping its label there. */
.sl-go {
  min-height: 28px;
  padding: 2px 12px;
  font-size: 0.78rem;
}

.sl-go:disabled {
  opacity: 0.5;
  cursor: default;
}

.file-input {
  display: none;
}

/* On a phone the roster menu takes the room the round buttons leave, so
   Generate stays on the row. */
@media (max-width: 768px) {
  .sl-bar :deep(.roster-menu) {
    flex: 1;
    min-width: 0;
    --dropdown-trigger-width: 100%;
    --dropdown-trigger-min-width: 0;
  }
  .sl-go {
    min-height: var(--control-height-tablet);
    border-radius: 999px;
  }
}

@media (max-width: 480px) {
  .sl-go {
    min-height: var(--control-height-mobile);
  }
}
</style>

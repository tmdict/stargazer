<script setup lang="ts">
/* The Import and Export buttons of a saved library's backup file (saved teams,
   rosters), with the file picker and their tooltips. */

import { ref } from 'vue'

import IconDownload from '@/components/ui/IconDownload.vue'
import IconUpload from '@/components/ui/IconUpload.vue'
import TooltipPopup from '@/components/ui/TooltipPopup.vue'
import { useHoverTooltip } from '@/composables/useHoverTooltip'
import { useI18nStore } from '@/stores/i18n'

const { exportLabel } = defineProps<{
  importTip: string
  exportTip: string
  canExport: boolean
  exportLabel?: string
}>()

const emit = defineEmits<{ export: []; file: [event: Event] }>()

const i18n = useI18nStore()
const fileInput = ref<HTMLInputElement>()

const {
  anchor: tipEl,
  payload: tip,
  onMouseEnter: showTip,
  onMouseLeave: hideTip,
} = useHoverTooltip<string>()
</script>

<template>
  <button
    type="button"
    class="control-btn compact secondary"
    :aria-label="i18n.t('app.import')"
    @click="fileInput?.click()"
    @mouseenter="showTip($event, importTip)"
    @mouseleave="hideTip"
  >
    <IconUpload :size="13" class="btn-icon" />
    <span class="btn-text">{{ i18n.t('app.import') }}</span>
  </button>
  <button
    v-if="canExport"
    type="button"
    class="control-btn compact secondary"
    :aria-label="exportLabel ?? i18n.t('app.export')"
    @click="emit('export')"
    @mouseenter="showTip($event, exportTip)"
    @mouseleave="hideTip"
  >
    <IconDownload :size="13" class="btn-icon" />
    <span class="btn-text">{{ exportLabel ?? i18n.t('app.export') }}</span>
  </button>
  <input
    ref="fileInput"
    type="file"
    accept="application/json,.json"
    class="file-input"
    @change="emit('file', $event)"
  />
  <TooltipPopup v-if="tip && tipEl" :target-element="tipEl">
    <template #content>{{ tip }}</template>
  </TooltipPopup>
</template>

<style scoped>
.file-input {
  display: none;
}
</style>

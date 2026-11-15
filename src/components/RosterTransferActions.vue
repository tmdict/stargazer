<script setup lang="ts">
/* The roster library's file controls, as the Rosters tab and the Supreme
   League generator show them: the screenshot import, then the rosters file
   import and export. An import merges into the library and never replaces
   it. Export writes every saved roster unless the host hands it a file of its
   own: the generator does, under All heroes, for the heroes on its screen. */

import LibraryTransferButtons from './LibraryTransferButtons.vue'
import RosterImportButton from './RosterImportButton.vue'
import TooltipPopup from '@/components/ui/TooltipPopup.vue'
import { useHoverTooltip } from '@/composables/useHoverTooltip'
import { useRostersTransfer } from '@/composables/useLibraryTransfer'
import type { RostersExportFile } from '@/lib/rosters'
import { useI18nStore } from '@/stores/i18n'
import { useRosters } from '@/stores/rosters'

const { exportFile } = defineProps<{ exportFile?: () => RostersExportFile }>()

const rosters = useRosters()
const i18n = useI18nStore()

const { download, handleFileChosen } = useRostersTransfer()

const { anchor: tipEl, onMouseEnter: showTip, onMouseLeave: hideTip } = useHoverTooltip()
</script>

<template>
  <RosterImportButton @click="hideTip" @mouseenter="showTip" @mouseleave="hideTip" />
  <LibraryTransferButtons
    :import-tip="i18n.t('app.tooltip-rosters-import')"
    :export-tip="
      i18n.t(exportFile ? 'app.tooltip-roster-export-shown' : 'app.tooltip-rosters-export')
    "
    :can-export="!!exportFile || rosters.count > 0"
    @export="download(exportFile ? exportFile() : rosters.exportRosters())"
    @file="handleFileChosen"
  />
  <TooltipPopup v-if="tipEl" :target-element="tipEl">
    <template #content>{{ i18n.t('app.tooltip-roster-import') }}</template>
  </TooltipPopup>
</template>

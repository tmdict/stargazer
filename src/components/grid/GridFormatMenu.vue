<script setup lang="ts">
/* The Format control: the game formats a lone board can play, each row on its
   own. Non-Seasonal keeps phantimals and the season's artifacts off the board,
   Synergy opens each team's friend-assist slot. */

import { computed } from 'vue'

import ToggleChipMenu from '@/components/ui/ToggleChipMenu.vue'
import { useSelectionState } from '@/composables/useSelectionState'
import { useGrids } from '@/stores/grids'
import { useI18nStore } from '@/stores/i18n'

type FormatKey = 'non-seasonal' | 'syn'

const grids = useGrids()
const i18n = useI18nStore()
const { clearTargetHex, clearLiftedHex } = useSelectionState()

const isOn = (key: FormatKey): boolean => (key === 'syn' ? grids.synergy : grids.nonSeasonal)

const groups = computed(() => [
  {
    rows: (['non-seasonal', 'syn'] as const).map((key) => ({
      key,
      label: i18n.t(`app.${key}`),
      checked: isOn(key),
    })),
  },
])

const onToggle = (key: FormatKey): void => {
  const on = !isOn(key)
  if (key === 'syn') grids.setSynergy(on)
  else grids.setNonSeasonal(on)
  // Leaving Synergy or entering Non-Seasonal takes units off the board, maybe
  // the one a pending tap or lift points at.
  const removesUnits = key === 'syn' ? !on : on
  if (removesUnits) {
    clearTargetHex()
    clearLiftedHex()
  }
}
</script>

<template>
  <ToggleChipMenu plain :label="i18n.t('app.format')" :groups @toggle="onToggle" />
</template>

<script setup lang="ts">
/* The Honor Duel tab's pane: the mode's lists, one on show at a time. A tab
   strip keeps every pane mounted, so a list and its data are fetched only once
   the tab is first opened. With `board` the pane works on the Honor Duel
   board: its units are the first list, and its map buttons stand beside the
   lists' control. */

import { computed, ref, watch } from 'vue'

import DuelMapButtons from './DuelMapButtons.vue'
import HonorDuelHeroes from './HonorDuelHeroes.vue'
import SegmentedPicker from '@/components/ui/SegmentedPicker.vue'
import { useSelectionState } from '@/composables/useSelectionState'
import { useI18nStore } from '@/stores/i18n'
import { defineLazyComponent } from '@/utils/lazyComponent'
import { gameLabel } from '@/utils/skillLabels'

const {
  active,
  scrollable = true,
  board = false,
} = defineProps<{
  active: boolean
  // See CharacterSelection: off when the picker flows in normal page height.
  scrollable?: boolean
  board?: boolean
}>()

const HonorDuelSelection = defineLazyComponent(() => import('./HonorDuelSelection.vue'))

const i18n = useI18nStore()

const opened = ref(active)
watch(
  () => active,
  (isActive) => {
    if (isActive) opened.value = true
  },
)

type DuelList = 'units' | 'artifact' | 'equipment'

const list = ref<DuelList>(board ? 'units' : 'artifact')

// A tapped tile of the board raises the sheet on this tab to take a unit.
const { targetTile } = useSelectionState()
watch(targetTile, (tile) => {
  if (board && tile?.ctx.kind === 'honorDuel') list.value = 'units'
})

const lists = computed(() => {
  const locale = i18n.currentLocale
  const entries: { key: DuelList; label: string }[] = [
    ...(board ? [{ key: 'units' as const, label: i18n.t('app.units') }] : []),
    { key: 'artifact', label: gameLabel('duel-artifact', locale) },
    { key: 'equipment', label: gameLabel('equipment', locale) },
  ]
  return entries.map((entry) => ({ ...entry, selected: entry.key === list.value }))
})
</script>

<template>
  <div v-scroll-chain class="duel-pane panel-min-height" :class="{ 'panel-fill': scrollable }">
    <template v-if="opened">
      <div class="duel-controls picker-top-row">
        <SegmentedPicker
          small
          :segments="lists"
          :aria-label="i18n.t('app.honor-duel')"
          @select="list = $event"
        />
        <DuelMapButtons v-if="board" />
      </div>
      <!-- Kept mounted, so its filters outlast a look at another list. -->
      <HonorDuelHeroes v-if="board" v-show="list === 'units'" />
      <HonorDuelSelection v-if="list !== 'units'" :kind="list" />
    </template>
  </div>
</template>

<style scoped>
.duel-pane {
  display: flex;
  flex-direction: column;
  gap: var(--picker-row-gap);
}

.duel-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-md);
}
</style>

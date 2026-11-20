<script setup lang="ts">
/* The Arena board's map as a menu at the end of the tab row, on windows wide
   enough for it. Narrower ones show the strip of buttons (ArenaMapButtons). */

import { computed } from 'vue'

import DropdownSelect, { type DropdownItem } from '@/components/ui/DropdownSelect.vue'
import { useArenaMapSlots, type ArenaMapSlot } from '@/composables/useArenaPick'
import { useGrids } from '@/stores/grids'
import { useI18nStore } from '@/stores/i18n'

const grids = useGrids()
const i18n = useI18nStore()
const { slots, held, select } = useArenaMapSlots()

// A pick would move the Arena board, which is not on screen while an Honor
// Duel board is. That board's maps are in its own tab.
const onArena = computed(() => grids.active?.kind !== 'honorDuel')

const rowLabel = (slot: ArenaMapSlot): string =>
  `${slot.mode.toUpperCase()} ${i18n.t('app.arena')} ${slot.number}`

const items = computed((): DropdownItem[] =>
  slots.map((slot) => ({ key: slot.key, label: rowLabel(slot), selected: slot === held.value })),
)
</script>

<template>
  <DropdownSelect
    v-if="onArena"
    class="arena-map-menu"
    variant="tab"
    :label="held ? rowLabel(held) : i18n.t('app.arena')"
    :items
    @select="select"
  />
</template>

<script setup lang="ts">
/* The Arena board's map as the tab row's menu, `SL Arena 1` to `GD Arena 3`. */

import { computed } from 'vue'

import MapMenu from './MapMenu.vue'
import { useArenaMapSlots, type ArenaMapSlot } from '@/composables/useArenaPick'
import { useI18nStore } from '@/stores/i18n'

const i18n = useI18nStore()
const { slots, held, select } = useArenaMapSlots()

const rowLabel = (slot: ArenaMapSlot): string =>
  `${slot.mode.toUpperCase()} ${i18n.t('app.arena')} ${slot.number}`

const maps = computed(() =>
  slots.map((slot) => ({ key: slot.key, label: rowLabel(slot), selected: slot === held.value })),
)
</script>

<template>
  <MapMenu :label="held ? rowLabel(held) : i18n.t('app.arena')" :maps @select="select" />
</template>

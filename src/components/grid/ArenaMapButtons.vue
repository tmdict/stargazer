<script setup lang="ts">
/* The Arena board's map as a strip of buttons, `SL1` to `GD3`: a pick moves
   the board onto that map with the buffs it has on that list. Windows wide
   enough for the tab row's menu (ArenaDropdown) show that instead. */

import { computed } from 'vue'

import MapButtons from './MapButtons.vue'
import { useArenaMapSlots } from '@/composables/useArenaPick'

const { slots, held, select } = useArenaMapSlots()

const maps = computed(() =>
  slots.map((slot) => ({ key: slot.key, label: slot.key, selected: slot === held.value })),
)
</script>

<template>
  <MapButtons class="arena-map-strip" :maps dense @select="select" />
</template>

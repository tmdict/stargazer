<script setup lang="ts">
/* The Honor Duel board's map as a strip of buttons, I to V. Windows wide
   enough for the tab row's menu (DuelMapMenu) show that instead. */

import { computed } from 'vue'

import MapButtons from '@/components/grid/MapButtons.vue'
import { useDuelMapSlots } from '@/composables/useDuelMapSlots'

const { slots, held, select } = useDuelMapSlots()

const maps = computed(() =>
  slots.map(({ key, name }) => ({ key, label: name, selected: key === held.value?.key })),
)
</script>

<template>
  <MapButtons :maps @select="select" />
</template>

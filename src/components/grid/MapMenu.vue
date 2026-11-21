<script setup lang="ts">
/* A board's map as a menu at the end of the tab row. A window 1320px wide or
   more shows it in place of the board's strip of buttons (MapButtons); the
   switch is in base.css. */

import DropdownSelect, { type DropdownItem } from '@/components/ui/DropdownSelect.vue'

defineProps<{
  label: string
  maps: readonly DropdownItem[]
}>()

const emit = defineEmits<{ select: [map: string] }>()
</script>

<template>
  <DropdownSelect
    class="map-menu"
    variant="tab"
    :label
    :items="maps"
    @select="emit('select', $event)"
  />
</template>

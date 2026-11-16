<script setup lang="ts">
/* The Honor Duel tab's pane. A tab strip keeps every pane mounted, so the list
   and its data are fetched only once the tab is first opened. */

import { ref, watch } from 'vue'

import { defineLazyComponent } from '@/utils/lazyComponent'

const { active, scrollable = true } = defineProps<{
  active: boolean
  scrollable?: boolean
}>()

const HonorDuelSelection = defineLazyComponent(() => import('./HonorDuelSelection.vue'))

const opened = ref(active)
watch(
  () => active,
  (isActive) => {
    if (isActive) opened.value = true
  },
)
</script>

<template>
  <HonorDuelSelection v-if="opened" :scrollable />
</template>

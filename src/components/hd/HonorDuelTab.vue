<script setup lang="ts">
/* The Honor Duel tab's pane. A tab strip keeps every pane mounted, so the list
   and its data are fetched only once the tab is first opened. With `board` the
   pane works on the Honor Duel board, and its pickers come first. */

import { ref, watch } from 'vue'

import HonorDuelHeroes from './HonorDuelHeroes.vue'
import { defineLazyComponent } from '@/utils/lazyComponent'

const {
  active,
  scrollable = true,
  board = false,
} = defineProps<{
  active: boolean
  scrollable?: boolean
  board?: boolean
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
  <div
    v-if="board"
    v-scroll-chain
    class="duel-pane panel-min-height"
    :class="{ 'panel-fill': scrollable }"
  >
    <template v-if="opened">
      <HonorDuelHeroes />
      <HonorDuelSelection :scrollable="false" />
    </template>
  </div>
  <HonorDuelSelection v-else-if="opened" :scrollable />
</template>

<style scoped>
.duel-pane {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
}
</style>

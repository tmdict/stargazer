<script setup lang="ts">
/* A picture of the app with its words drawn as rune shapes, so it shows a
   layout without being read as real text. `words` is a selector for the
   elements whose text stays readable. */

import { useTemplateRef } from 'vue'

import { useRuneText } from '@/composables/useRuneText'

const { words } = defineProps<{ words?: string }>()

useRuneText(useTemplateRef<HTMLElement>('root'), words)
</script>

<template>
  <div ref="root" class="rune-picture">
    <slot />
  </div>
</template>

<style scoped>
.rune-picture :deep(.rune-word) {
  white-space: nowrap;
}

.rune-picture :deep(.rune-word svg) {
  display: inline-block;
  vertical-align: 0;
  margin-right: 0.12em;
  overflow: visible;
  fill: currentColor;
  stroke: currentColor;
  stroke-width: 0.7;
  stroke-linejoin: round;
}
</style>

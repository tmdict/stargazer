<script setup lang="ts">
/* A Help-style picture in What's New, its words drawn as rune shapes. */

import { useTemplateRef } from 'vue'

import { useRuneText } from '@/composables/useRuneText'

useRuneText(useTemplateRef<HTMLElement>('root'))
</script>

<template>
  <div ref="root" class="whats-new-picture">
    <slot />
  </div>
</template>

<style scoped>
.whats-new-picture :deep(.rune-word) {
  white-space: nowrap;
}

.whats-new-picture :deep(.rune-word svg) {
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

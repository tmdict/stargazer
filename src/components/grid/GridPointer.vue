<script setup lang="ts">
import { STANDING_POINTER_HEIGHT } from '@/lib/layout'
</script>

<template>
  <div class="grid-pointer" :style="{ '--standing-pointer': `${STANDING_POINTER_HEIGHT}px` }" />
</template>

<style scoped>
.grid-pointer {
  position: absolute;
  bottom: calc(-1 * var(--standing-pointer));
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-top: var(--standing-pointer) solid #777;
}
</style>

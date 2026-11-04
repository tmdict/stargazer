<script setup lang="ts">
import UpgradeIcon from '@/components/ui/UpgradeIcon.vue'

defineProps<{ kind: 'paragon' | 'refinement'; level: number }>()
</script>

<template>
  <span class="upgrade-level-label">
    <UpgradeIcon :kind before-level />
    <span>{{ level }}</span>
  </span>
</template>

<style scoped>
.upgrade-level-label {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 1em;
  font-family: var(--font-ui);
  line-height: 1;
}

/* Digits have no descenders; center them inside a stable line box so font
   metrics don't change the chip's height or alignment. */
.upgrade-level-label > span {
  text-box: trim-both cap alphabetic;
}
</style>

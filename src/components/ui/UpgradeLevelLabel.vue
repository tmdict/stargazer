<script setup lang="ts">
defineProps<{ kind: 'paragon' | 'refinement'; level: number }>()
</script>

<template>
  <span class="upgrade-level-label">
    <span>{{ kind === 'paragon' ? 'P' : 'R' }}{{ level }}</span>
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

/* P/R and digits have no descenders; center their capitals inside a stable
   line box so font metrics don't change the chip's height or alignment. */
.upgrade-level-label > span {
  text-box: trim-both cap alphabetic;
}
</style>

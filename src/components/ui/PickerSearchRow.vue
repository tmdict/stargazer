<script setup lang="ts">
/* The row above a hero picker's filters that holds its search trigger (the
   Arena and Teams picker, the skill pages' hero list). */
</script>

<template>
  <div class="picker-search-row picker-top-row">
    <slot />
  </div>
</template>

<style scoped>
.picker-search-row {
  display: flex;
}

@media (min-width: 769px) {
  .picker-search-row {
    padding-right: var(--picker-scrollbar-inset);
  }
}

@media (max-width: 768px) {
  .picker-search-row :deep(.search-trigger) {
    max-width: none;
  }
}
</style>

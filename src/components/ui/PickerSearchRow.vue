<script setup lang="ts">
/* The row above a hero picker's filters that holds its search trigger (the
   Arena and Teams picker, the skill pages' hero list). */
</script>

<template>
  <div class="picker-search-row">
    <slot />
  </div>
</template>

<style scoped>
.picker-search-row {
  display: flex;
  padding-right: var(--picker-scrollbar-inset);
}

@media (max-width: 768px) {
  .picker-search-row {
    padding: var(--spacing-sm) var(--spacing-md) 0;
  }
  .picker-search-row :deep(.search-trigger) {
    max-width: none;
  }
}

@media (max-width: 480px) {
  .picker-search-row {
    padding: var(--spacing-sm) var(--spacing-sm) 0;
  }
}
</style>

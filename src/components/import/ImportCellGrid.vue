<template>
  <div class="cells">
    <slot />
  </div>
</template>

<style scoped>
.cells {
  display: grid;
  grid-template-columns: var(--import-columns);
  gap: var(--spacing-sm);
}

@media (max-width: 720px) {
  .cells {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>

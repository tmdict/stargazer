<template>
  <span class="dock-label"><slot /></span>
</template>

<style scoped>
.dock-label {
  font-size: calc(0.55rem * var(--dock-scale));
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--color-text-secondary);
  margin: 0 2px;
}
</style>

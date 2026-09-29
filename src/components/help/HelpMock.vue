<script setup lang="ts">
defineProps<{ caption: string }>()
</script>

<template>
  <div class="help-mock">
    <div class="help-mock-cap">{{ caption }}</div>
    <slot />
  </div>
</template>

<style scoped>
/* 80% so both screens fit side by side. */
.help-mock {
  zoom: 0.8;
  flex: 1;
  min-width: 0;
  align-self: stretch;
  padding: 12px;
  color: var(--color-text-primary);
  background: var(--color-bg-primary);
  border-radius: var(--radius-medium);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.help-mock-cap {
  margin: 0 0 10px;
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--color-text-secondary);
}

:slotted(.help-mock-bar) {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  margin-bottom: 12px;
}

:slotted(.help-mock-bar.centered) {
  justify-content: center;
  flex-wrap: wrap;
}

.help-mock :slotted(.control-btn) {
  padding: var(--spacing-xs) 9px;
}
</style>

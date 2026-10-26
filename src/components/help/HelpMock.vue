<script setup lang="ts">
defineProps<{ caption: string; glass?: boolean }>()
</script>

<template>
  <div class="help-mock" :class="{ 'glass-panel': glass }">
    <div class="help-mock-cap">{{ caption }}</div>
    <slot />
  </div>
</template>

<style scoped>
.help-mock {
  zoom: 0.8;
  flex: 1;
  min-width: 0;
  align-self: stretch;
  padding: 12px;
  color: var(--color-text-primary);
}

.help-mock:not(.glass-panel) {
  background: var(--color-bg-primary);
  border-radius: var(--radius-medium);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.help-mock.glass-panel {
  color: var(--import-text);
}

.glass-panel .help-mock-cap {
  color: var(--import-text-dim);
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

<script setup lang="ts">
/* Invert toggle in the grid controls: a labeled checkbox. Rotates the rendered
   board 180 degrees (a pure view transform); content stays canonical. */

import { useGrids } from '@/stores/grids'
import { useI18nStore } from '@/stores/i18n'

const i18n = useI18nStore()
const grids = useGrids()

const onToggle = () => {
  grids.inverted = !grids.inverted
}
</script>

<template>
  <label class="invert-toggle" :class="{ active: grids.inverted }">
    <input type="checkbox" :checked="grids.inverted" class="invert-checkbox" @change="onToggle" />
    <span class="invert-text">{{ i18n.t('app.invert') }}</span>
  </label>
</template>

<style scoped>
.invert-toggle {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
  user-select: none;
  border: 2px solid;
  border-radius: var(--radius-medium);
  padding: var(--spacing-xs) var(--spacing-md);
  transition: all var(--transition-fast);
  min-height: 36px;
  flex-shrink: 0;
  white-space: nowrap;
  color: var(--color-text-secondary);
  background: var(--color-bg-primary);
  border-color: var(--color-border-primary);
}

.invert-toggle:hover {
  background: var(--color-bg-tertiary);
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.invert-checkbox {
  width: 0.9rem;
  height: 0.9rem;
  cursor: pointer;
  accent-color: var(--color-primary);
  margin: 0;
}

.invert-text {
  font-weight: 600;
}

/* Mobile: match the grid-control toggles (Flat, Grid Info, ...): a pill chip whose
   fill is the on/off state, so the checkbox is dropped. */
@media (max-width: 768px) {
  .invert-toggle {
    border-radius: 999px;
    border-width: 1px;
    border-color: var(--color-border-primary);
    background: var(--color-bg-secondary);
    color: var(--color-text-secondary);
    padding: 5px 11px;
    min-height: 34px;
    gap: 0;
    font-size: 0.78rem;
    font-weight: 500;
  }
  .invert-toggle.active {
    background: var(--color-primary);
    border-color: var(--color-primary);
    color: #fff;
  }
  .invert-checkbox {
    display: none;
  }
}
@media (max-width: 480px) {
  .invert-toggle {
    padding: 4px 10px;
    min-height: 30px;
    font-size: 0.74rem;
  }
}
</style>

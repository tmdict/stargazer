<script setup lang="ts">
/* Invert toggle in the grid controls: a labeled checkbox. Flips the global
   ally/enemy presentation AND mirror-swaps every board's units to the opposite
   team, so a formation rotates to the other side keeping its shape and colour. */

import { useGrids } from '@/stores/grids'
import { useI18nStore } from '@/stores/i18n'
import { useUrlStateStore } from '@/stores/urlState'

const i18n = useI18nStore()
const grids = useGrids()
const urlState = useUrlStateStore()

const onToggle = () => {
  grids.inverted = !grids.inverted
  urlState.swapTeamsAllBoards()
}
</script>

<template>
  <label class="invert-toggle">
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
  font-family: sans-serif;
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
</style>

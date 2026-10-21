<script setup lang="ts">
/* A checkbox drawn as a chip: the grid controls bar's display toggles, the
   Grid Info chip (split by its `caret` slot) and the Map Editor's Edit Tiles.
   A root given the global .glass-button class (modal.css) keeps that look in
   place of the light one. */

const checked = defineModel<boolean>()

defineProps<{
  label: string
  disabled?: boolean
  // Outside the grid controls bar: sized by its text, without the bar's
  // touch-tablet and phone looks.
  standalone?: boolean
}>()

defineSlots<{ caret?(): unknown }>()
</script>

<template>
  <span v-if="$slots.caret" class="toggle-chip split">
    <label class="toggle-chip-body">
      <input v-model="checked" type="checkbox" class="toggle-chip-checkbox" />
      <span>{{ label }}</span>
    </label>
    <slot name="caret" />
  </span>
  <label
    v-else
    class="toggle-chip toggle-chip-body"
    :class="{ bar: !standalone, active: checked, disabled }"
  >
    <input v-model="checked" type="checkbox" :disabled class="toggle-chip-checkbox" />
    <span>{{ label }}</span>
  </label>
</template>

<style scoped>
.toggle-chip {
  display: flex;
  font-size: var(--control-font-size);
  font-weight: var(--control-font-weight);
  user-select: none;
  transition: all var(--transition-fast);
}

.toggle-chip:not(.glass-button) {
  border: 2px solid var(--color-border-primary);
  border-radius: var(--radius-medium);
  color: var(--color-text-secondary);
  background: var(--color-bg-primary);
}

.toggle-chip:not(.glass-button):hover {
  background: var(--color-bg-tertiary);
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.toggle-chip.bar,
.toggle-chip.split {
  min-height: var(--control-height);
  white-space: nowrap;
}

.toggle-chip.bar {
  flex-shrink: 0;
}

.toggle-chip.split {
  align-items: stretch;
}

.toggle-chip.disabled {
  opacity: 0.45;
  cursor: not-allowed;
  pointer-events: none;
}

.toggle-chip-body {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-md);
  cursor: pointer;
}

.split .toggle-chip-body {
  padding-right: var(--spacing-sm);
}

.toggle-chip-checkbox {
  width: 0.9rem;
  height: 0.9rem;
  cursor: pointer;
  accent-color: var(--color-primary);
  margin: 0;
}

@media (pointer: coarse) and (min-width: 1220px) {
  .toggle-chip-body.bar,
  .split .toggle-chip-body {
    padding-left: var(--spacing-sm);
    padding-right: var(--spacing-sm);
  }
}

@media (max-width: 768px) {
  .toggle-chip.bar {
    border-radius: 999px;
    border-width: 1px;
    border-color: var(--color-border-primary);
    background: var(--color-bg-secondary);
    color: var(--color-text-secondary);
    padding: var(--toggle-chip-padding-tablet);
    min-height: var(--control-height-tablet);
    gap: 0;
    font-size: var(--toggle-chip-font-size-tablet);
  }
  .toggle-chip.bar.active {
    background: var(--color-primary);
    border-color: var(--color-primary);
    color: #fff;
  }
  .bar .toggle-chip-checkbox {
    display: none;
  }
}

@media (max-width: 480px) {
  .toggle-chip.bar {
    padding: var(--toggle-chip-padding-mobile);
    min-height: var(--control-height-mobile);
    font-size: var(--toggle-chip-font-size-mobile);
  }
}
</style>

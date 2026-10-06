<script setup lang="ts">
/* A toggle chip with a hero count. `large` is the size of the dropdown pills
   it sits beside; `dark` is for the guide's panels. */

defineProps<{
  label: string
  count: number
  active?: boolean
  large?: boolean
  dark?: boolean
}>()
</script>

<template>
  <button type="button" class="chip" :class="{ active, large, dark }" :aria-pressed="active">
    <span>{{ label }}</span>
    <span class="count">{{ count }}</span>
  </button>
</template>

<style scoped>
.chip {
  display: inline-flex;
  align-items: center;
  gap: var(--chip-count-gap);
  padding: 3px 10px;
  border: 1.5px solid var(--color-border-primary);
  border-radius: 999px;
  background: var(--color-bg-white);
  color: var(--color-text-secondary);
  font: inherit;
  font-size: 0.8rem;
  font-weight: 600;
  line-height: 1.4;
  white-space: nowrap;
  cursor: pointer;
  transition:
    border-color var(--transition-fast),
    background-color var(--transition-fast);
}

.count {
  opacity: var(--chip-count-opacity);
}

.chip:hover {
  border-color: var(--color-primary);
}

.chip.active {
  border-color: var(--color-primary);
  background: color-mix(in srgb, var(--color-primary) 13%, transparent);
  color: var(--color-primary-hover);
}

.chip:disabled {
  opacity: 0.4;
  cursor: default;
}

.chip:disabled:hover {
  border-color: var(--color-border-primary);
}

.large {
  min-height: var(--pill-large-height);
  padding: 0 var(--pill-large-padding);
  border-width: var(--pill-large-border);
  font-size: var(--control-font-size);
  font-weight: var(--control-font-weight);
}

.dark {
  padding: var(--chip-dark-padding-block) 9px;
  border-width: 1px;
  border-color: var(--chip-dark-border-color);
  background: transparent;
  color: var(--chip-dark-color);
  font-size: var(--chip-dark-font-size);
}

.dark:hover {
  border-color: var(--color-accent);
}

.dark.active {
  border-color: var(--color-accent);
  background: var(--chip-dark-active-background);
  color: var(--color-accent);
}

.dark:disabled:hover {
  border-color: var(--chip-dark-border-color);
}
</style>

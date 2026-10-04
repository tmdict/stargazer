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
  gap: 5px;
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
  opacity: 0.6;
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
  padding: 2px 9px;
  border-width: 1px;
  border-color: rgba(255, 255, 255, 0.22);
  background: transparent;
  color: rgba(255, 255, 255, 0.74);
  font-size: 0.72rem;
}

.dark:hover {
  border-color: var(--color-accent);
}

.dark.active {
  border-color: var(--color-accent);
  background: color-mix(in srgb, var(--color-accent) 18%, transparent);
  color: var(--color-accent);
}

.dark:disabled:hover {
  border-color: rgba(255, 255, 255, 0.22);
}
</style>

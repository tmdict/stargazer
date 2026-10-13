<script setup lang="ts">
/* A toggle chip with a hero count. `large` is the size of the dropdown pills
   it sits beside; `dark` is for the guide's panels. With `join` it is one part
   of a pill made of several chips, square on the sides where the pill goes
   on. */

import type { PillJoin } from '@/composables/usePillJoins'

defineProps<{
  label: string
  count: number
  active?: boolean
  large?: boolean
  dark?: boolean
  join?: PillJoin
}>()
</script>

<template>
  <button
    type="button"
    class="chip"
    :class="{
      active,
      large,
      dark,
      joined: join,
      'joins-left': join?.left,
      'joins-right': join?.right,
    }"
    :aria-pressed="active"
  >
    <span>{{ label }}</span>
    <span class="count">{{ count }}</span>
  </button>
</template>

<style scoped>
.chip {
  display: inline-flex;
  align-items: center;
  gap: var(--chip-count-gap);
  padding: var(--chip-padding-block) 10px;
  border: var(--chip-border) solid var(--color-border-primary);
  border-radius: 999px;
  background: var(--color-bg-white);
  color: var(--color-text-secondary);
  font: inherit;
  font-size: var(--chip-font-size);
  font-weight: 600;
  line-height: var(--chip-line-height);
  white-space: nowrap;
  cursor: pointer;
  transition: border-color var(--transition-fast);
}

.count {
  opacity: var(--chip-count-opacity);
}

.chip:hover {
  border-color: var(--color-primary);
}

.chip.active {
  border-color: var(--color-primary);
  background: var(--color-primary);
  color: #fff;
}

.chip.active:not(.dark) .count {
  opacity: 0.8;
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

/* ---- joined: one part of a pill ---- */

.joined,
.joined:disabled:hover {
  border-color: var(--color-primary);
}

.joined {
  transition: none;
}

.joined:disabled {
  opacity: 1;
  color: color-mix(in srgb, var(--color-text-secondary) 40%, transparent);
}

.joined:not(.active):not(:disabled):hover {
  background: var(--color-bg-tertiary);
}

.joins-left {
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
}

.active + .active.joins-left {
  border-left-color: color-mix(in srgb, var(--color-primary) 50%, var(--color-bg-white));
}

.chip.joined.joins-right {
  border-right-color: transparent;
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}
</style>

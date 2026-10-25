<script setup lang="ts">
/* A number stepped down and up by two buttons, for a filter that takes a
   value. It is the size of the dropdown pills it sits beside; `dark` is the
   size and look of the chips on the guide's panels. `compact` is the two
   buttons alone at a filter chip's size, for a stepper beside the chip that
   shows its value; with `join` it is the last part of that chip's pill. */

import IconMinus from './IconMinus.vue'
import IconPlus from './IconPlus.vue'
import type { PillJoin } from '@/composables/usePillJoins'

const { min, max, step } = defineProps<{
  // Names the control for assistive tech; the two buttons have their own names.
  label: string
  lowerLabel: string
  raiseLabel: string
  min: number
  max: number
  step: number
  // Heroes the current value keeps, as a filter chip shows.
  count?: number
  active?: boolean
  dark?: boolean
  compact?: boolean
  join?: PillJoin
}>()

const model = defineModel<number>({ required: true })

defineSlots<{
  default?(): unknown
}>()

const move = (direction: 1 | -1): void => {
  const next = model.value + direction * step
  if (next >= min && next <= max) model.value = next
}

const ARROWS: Record<string, 1 | -1> = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }

// With a modifier an arrow is the browser's or the system's shortcut (Back).
function onKeydown(e: KeyboardEvent) {
  const direction = ARROWS[e.key]
  if (!direction || e.altKey || e.ctrlKey || e.metaKey) return
  e.preventDefault()
  move(direction)
}
</script>

<template>
  <div
    class="stepper"
    :class="{ active, dark, compact, 'joins-left': join?.left }"
    role="group"
    :aria-label="label"
    @keydown="onKeydown"
  >
    <!-- aria-disabled, not disabled: a button at the end of the range keeps the
         focus it has, so the arrow keys still work from it. -->
    <button
      type="button"
      class="step"
      :aria-label="lowerLabel"
      :aria-disabled="model <= min"
      @click="move(-1)"
    >
      <IconMinus class="sign" />
    </button>
    <span class="value" aria-live="polite">
      <span>
        <slot>{{ model }}</slot>
      </span>
      <span v-if="count !== undefined" class="count">{{ count }}</span>
    </span>
    <button
      type="button"
      class="step"
      :aria-label="raiseLabel"
      :aria-disabled="model >= max"
      @click="move(1)"
    >
      <IconPlus class="sign" />
    </button>
  </div>
</template>

<style scoped>
.stepper {
  --stepper-line: var(--color-border-primary);
  display: inline-flex;
  align-items: stretch;
  flex: none;
  min-height: var(--pill-large-height);
  border: var(--pill-large-border) solid var(--stepper-line);
  border-radius: 999px;
  background: var(--color-bg-raised);
  color: var(--color-text-secondary);
  font-size: var(--control-font-size);
  font-weight: var(--control-font-weight);
  white-space: nowrap;
  transition: border-color var(--transition-fast);
}

.stepper.active {
  --stepper-line: var(--color-primary);
  color: var(--color-primary);
}

.step {
  display: grid;
  place-items: center;
  width: var(--pill-segment-width);
  padding: 0;
  border: none;
  background: none;
  color: inherit;
  font: inherit;
  font-size: var(--pill-segment-font-size);
  line-height: 1;
  cursor: pointer;
  transition: background-color var(--transition-fast);
}

.sign {
  stroke-width: 3;
}

.step:first-child {
  border-right: var(--pill-large-border) solid var(--stepper-line);
  border-radius: 999px 0 0 999px;
}

.step:last-child {
  border-left: var(--pill-large-border) solid var(--stepper-line);
  border-radius: 0 999px 999px 0;
}

.step:hover {
  background: var(--color-bg-tertiary);
}

.step[aria-disabled='true'] {
  opacity: 0.35;
  cursor: default;
}

.step[aria-disabled='true']:hover {
  background: none;
}

.value {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--chip-count-gap);
  min-width: 5.9em;
  padding: 0 10px;
  font-variant-numeric: tabular-nums;
}

.count {
  opacity: var(--chip-count-opacity);
}

.dark {
  --stepper-line: var(--chip-dark-border-color);
  min-height: 0;
  border-width: 1px;
  background: transparent;
  color: var(--chip-dark-color);
  font-size: var(--chip-dark-font-size);
  line-height: 1.4;
}

.dark:hover,
.dark.active {
  --stepper-line: var(--color-accent);
}

.dark.active {
  background: var(--chip-dark-active-background);
  color: var(--color-accent);
}

.dark .step {
  width: 24px;
  border: none;
  font-size: 0.9rem;
}

.dark .step:hover {
  background: rgba(255, 255, 255, 0.1);
}

.dark .step[aria-disabled='true']:hover {
  background: none;
}

.dark .value {
  min-width: 4.4em;
  padding: var(--chip-dark-padding-block) 2px;
}

/* ---- compact: the buttons alone ---- */

.compact {
  min-height: var(--chip-height);
  border-width: var(--chip-border);
  font-size: var(--chip-font-size);
}

.compact .step {
  width: 26px;
  font-size: 1rem;
}

.compact .step:first-child {
  border-right-width: var(--chip-border);
}

.compact .step:last-child {
  border-left: none;
}

.compact .value {
  position: absolute;
  width: 1px;
  height: 1px;
  min-width: 0;
  padding: 0;
  overflow: hidden;
  clip-path: inset(50%);
}

/* ---- joined: the last part of a pill ---- */

.joins-left {
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
}

.joins-left .step:first-child {
  border-radius: 0;
}

@media (max-width: 768px) {
  .stepper:not(.dark) .step {
    width: 46px;
  }
}
</style>

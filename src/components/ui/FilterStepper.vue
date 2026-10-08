<script setup lang="ts">
/* A number stepped down and up by two buttons, for a filter that takes a
   value. It is the size of the dropdown pills it sits beside; `dark` is the
   size and look of the chips on the guide's panels. */

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
    :class="{ active, dark }"
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
      −
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
      +
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
  background: var(--color-bg-white);
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

@media (max-width: 768px) {
  .stepper:not(.dark) .step {
    width: 46px;
  }
}
</style>

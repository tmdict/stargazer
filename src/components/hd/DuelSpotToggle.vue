<script setup lang="ts">
/* A hero's off-field control in the hero card. A tap starts a pick, which
   shows its side's six spots on the board for one to be tapped, and a second
   tap ends it. It is marked while the hero holds a spot. */

import { useI18nStore } from '@/stores/i18n'

defineProps<{
  held: boolean
  picking: boolean
}>()

const emit = defineEmits<{ toggle: [] }>()

const i18n = useI18nStore()
</script>

<template>
  <button
    type="button"
    class="spot-toggle"
    :class="{ held, picking }"
    :title="i18n.t('app.off-field')"
    :aria-label="i18n.t('app.off-field')"
    :aria-pressed="picking"
    @click="emit('toggle')"
  >
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path d="M12 3 19.8 7.5v9L12 21l-7.8-4.5v-9Z" />
    </svg>
  </button>
</template>

<style scoped>
.spot-toggle {
  position: relative;
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: none;
  color: var(--color-text-secondary);
  cursor: pointer;
}

.spot-toggle path {
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linejoin: round;
  stroke-dasharray: 3 2.4;
}

.spot-toggle.held {
  color: var(--color-primary);
}

.spot-toggle.held path {
  fill: color-mix(in srgb, currentColor 22%, transparent);
  stroke-dasharray: none;
}

.spot-toggle.picking {
  background: var(--color-primary);
  color: #fff;
}

@media (hover: hover) {
  .spot-toggle:not(.picking):hover {
    color: var(--color-primary);
  }
}

@media (pointer: coarse) {
  .spot-toggle::after {
    content: '';
    position: absolute;
    inset: -6px -3px;
  }
}
</style>

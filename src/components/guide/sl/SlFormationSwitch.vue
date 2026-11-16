<script setup lang="ts">
/* The debug view's switch on a board that has a recorded game's formation,
   between that formation (the check) and the engine's (the sparkle), the one
   on show filled, with the comparison's numbers beside it. The chip is one
   button, so a press anywhere on it switches the board. */

import { computed } from 'vue'

import SlIcon from './SlIcon.vue'
import type { FormationScores } from '@/lib/pvp/generator/formation'
import { useI18nStore } from '@/stores/i18n'

const { engineOn, scores } = defineProps<{
  engineOn: boolean
  scores: FormationScores
}>()

const emit = defineEmits<{ switch: [engineOn: boolean] }>()

const i18n = useI18nStore()

const HALVES = [
  { engine: false, icon: 'check' },
  { engine: true, icon: 'sparkle' },
] as const

// Rule points: the recorded formation's and what its record adds, against the engine's.
const points = (value: number): string => String(Math.round(value * 10) / 10)
const numbers = computed(
  () => `${points(scores.played)} + ${points(scores.bonus)} / ${points(scores.engine)}`,
)
</script>

<template>
  <button
    type="button"
    class="sl-switch"
    :aria-pressed="engineOn"
    :aria-label="i18n.t('app.sl-formation-suggested')"
    @click="emit('switch', !engineOn)"
  >
    <span
      v-for="{ engine, icon } in HALVES"
      :key="icon"
      class="sl-switch-half"
      :class="{ on: engine === engineOn }"
    >
      <SlIcon :name="icon" />
    </span>
    <span class="sl-switch-numbers">{{ numbers }}</span>
  </button>
</template>

<style scoped>
.sl-switch {
  display: inline-flex;
  gap: 1px;
  padding: 1px;
  border: 1px solid var(--color-border-primary);
  border-radius: 13px;
  background: var(--color-bg-secondary);
  color: var(--color-text-secondary);
  cursor: pointer;
}

.sl-switch-half {
  display: grid;
  place-items: center;
  width: 26px;
  height: 22px;
  border-radius: 11px;
}

.sl-switch-half.on {
  background: var(--color-primary);
  color: #fff;
}

.sl-switch-numbers {
  align-self: center;
  padding: 0 6px 0 4px;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.sl-switch .sl-icon {
  width: 15px;
  height: 15px;
}
</style>

<script setup lang="ts">
/* The debug view's switch on a board that has a recorded game's formation,
   between that formation (the check) and the engine's (the sparkle), the one
   on show filled, with the comparison's numbers beside it. The chip is one
   button, so a press anywhere on it switches the board and opens the tip of
   the formation then on show. Hovering a half shows what it is. */

import { computed } from 'vue'

import SlCard from './SlCard.vue'
import SlIcon from './SlIcon.vue'
import { useInfoTip } from '@/composables/useInfoTip'
import type { FormationScores } from '@/lib/pvp/generator/formation'
import { useI18nStore } from '@/stores/i18n'
import { interpolateParts, type TextPart } from '@/utils/interpolate'
import { useSlNames } from './useSlNames'

type Half = 'played' | 'engine'

// moved: the units moved from the recorded game's tiles, the phantimal first.
const { engineOn, moved, scores } = defineProps<{
  engineOn: boolean
  moved: number[]
  scores: FormationScores
}>()

const emit = defineEmits<{ switch: [engineOn: boolean] }>()

const i18n = useI18nStore()
const { cardNames } = useSlNames()
const { anchor, payload: half, hoverOpen, hoverClose, toggle, onTouchStart } = useInfoTip<Half>()

const halfEl: Partial<Record<Half, Element>> = {}

const HALVES: { half: Half; icon: 'check' | 'sparkle'; label: string; tip: string }[] = [
  {
    half: 'played',
    icon: 'check',
    label: 'app.sl-formation-recorded',
    tip: 'app.sl-formation-recorded-tip',
  },
  {
    half: 'engine',
    icon: 'sparkle',
    label: 'app.sl-formation-suggested',
    tip: 'app.sl-formation-suggested-tip',
  },
]

const shown = computed((): Half => (engineOn ? 'engine' : 'played'))
// Rule points: the recorded formation's and what its record adds, against the engine's.
const points = (value: number): string => String(Math.round(value * 10) / 10)
const numbers = computed(
  () => `${points(scores.played)} + ${points(scores.bonus)} / ${points(scores.engine)}`,
)

const press = (): void => {
  const next: Half = engineOn ? 'played' : 'engine'
  emit('switch', next === 'engine')
  // Open, never close: hover has often opened that half's tip already.
  if (anchor.value !== halfEl[next]) toggle(halfEl[next]!, next)
}

const card = computed(() => {
  const open = HALVES.find((h) => h.half === half.value)
  if (!open) return null
  const lines: { parts: TextPart[] }[] = [{ parts: [{ text: i18n.t(open.tip) }] }]
  if (open.half === 'played' && moved.length) {
    const units = cardNames(moved)
    lines.push({ parts: interpolateParts(i18n.t('app.sl-formation-moved'), { units }) })
  }
  return { title: [{ text: i18n.t(open.label) }], lines }
})
</script>

<template>
  <button
    type="button"
    class="sl-switch"
    :aria-pressed="engineOn"
    :aria-label="i18n.t('app.sl-formation-suggested')"
    @click="press"
    @focus="hoverOpen(halfEl[shown]!, shown)"
    @blur="hoverClose"
    @touchstart.passive="onTouchStart"
  >
    <span
      v-for="{ half: h, icon } in HALVES"
      :key="h"
      :ref="(el) => (halfEl[h] = el as Element)"
      class="sl-switch-half"
      :class="{ on: h === shown }"
      @mouseenter="hoverOpen($event, h)"
      @mouseleave="hoverClose"
    >
      <SlIcon :name="icon" />
    </span>
    <span class="sl-switch-numbers">{{ numbers }}</span>
    <SlCard v-if="anchor && card" :anchor :title="card.title" :lines="card.lines" plain />
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

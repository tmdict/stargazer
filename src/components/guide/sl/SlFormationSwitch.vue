<script setup lang="ts">
/* The switch on a board drawn from a recorded game: the check shows that
   game's formation and the sparkle the engine's, the one on show filled. The
   chip is one button, so a press anywhere on it switches the board and opens
   the tip of the formation then on show. Hovering a half shows what it is.
   The sparkle waits until the worker has placed the board, which it does just
   after the set is drawn; until then a press only shows a half's tip. */

import { computed } from 'vue'

import SlCard from './SlCard.vue'
import SlIcon from './SlIcon.vue'
import { useInfoTip } from '@/composables/useInfoTip'
import { useI18nStore } from '@/stores/i18n'
import { interpolateParts, type TextPart } from '@/utils/interpolate'
import { useSlNames } from './useSlNames'

type Half = 'played' | 'engine'

// moved: the units moved from the recorded game's tiles, the phantimal first.
const { engineOn, ready, moved } = defineProps<{
  engineOn: boolean
  ready: boolean
  moved: number[]
}>()

const emit = defineEmits<{ switch: [engineOn: boolean] }>()

const i18n = useI18nStore()
const { cardNames } = useSlNames()
const { anchor, payload: half, hoverOpen, hoverClose, toggle, onTouchStart } = useInfoTip<Half>()

// The halves' elements, which the tips anchor on.
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
const canSwitch = computed(() => engineOn || ready)

const halfAt = (target: EventTarget | null): Half =>
  HALVES.find(({ half }) => halfEl[half]?.contains(target as Node))?.half ?? shown.value

const press = (event: MouseEvent): void => {
  if (!canSwitch.value) {
    const pressed = halfAt(event.target)
    toggle(halfEl[pressed]!, pressed)
    return
  }
  emit('switch', !engineOn)
  const next: Half = engineOn ? 'played' : 'engine'
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
    :aria-disabled="canSwitch ? undefined : 'true'"
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
      :class="{ on: h === shown, waiting: h === 'engine' && !ready }"
      @mouseenter="hoverOpen($event, h)"
      @mouseleave="hoverClose"
    >
      <SlIcon :name="icon" />
    </span>
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

.sl-switch[aria-disabled='true'] {
  cursor: default;
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

.sl-switch-half.waiting {
  opacity: 0.45;
}

.sl-switch .sl-icon {
  width: 15px;
  height: 15px;
}
</style>

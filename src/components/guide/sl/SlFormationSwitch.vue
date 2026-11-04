<script setup lang="ts">
/* The switch on a board drawn from a recorded game: the check shows that
   game's formation and the sparkle the engine's, the one on show filled.
   Hovering a half, or tapping it, shows what it is; pressing the half not on
   show switches the board. The sparkle waits until the worker has placed the
   board, which it does just after the set is drawn. */

import { computed } from 'vue'

import SlCard from './SlCard.vue'
import SlIcon from './SlIcon.vue'
import { useInfoTip } from '@/composables/useInfoTip'
import { useI18nStore } from '@/stores/i18n'
import { interpolateParts } from '@/utils/interpolate'
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

const HALVES: { half: Half; icon: 'check' | 'sparkle'; label: string }[] = [
  { half: 'played', icon: 'check', label: 'app.sl-formation-recorded' },
  { half: 'engine', icon: 'sparkle', label: 'app.sl-formation-suggested' },
]

const press = (event: MouseEvent, pressed: Half): void => {
  const on = pressed === 'engine'
  if (on === engineOn || (on && !ready)) {
    toggle(event, pressed)
    return
  }
  emit('switch', on)
  if (anchor.value !== event.currentTarget) toggle(event, pressed)
}

const card = computed(() => {
  if (!half.value) return null
  const { label } = HALVES.find((h) => h.half === half.value)!
  const lines =
    half.value === 'played'
      ? [
          { parts: [{ text: i18n.t('app.sl-formation-recorded-tip') }] },
          ...(moved.length
            ? [
                {
                  parts: interpolateParts(i18n.t('app.sl-formation-moved'), {
                    units: cardNames(moved),
                  }),
                },
              ]
            : []),
        ]
      : [{ parts: [{ text: i18n.t('app.sl-formation-suggested-tip') }] }]
  return { title: [{ text: i18n.t(label) }], lines }
})
</script>

<template>
  <span class="sl-switch" role="group" :aria-label="i18n.t('app.sl-formation')">
    <button
      v-for="{ half: h, icon, label } in HALVES"
      :key="h"
      type="button"
      :class="{ on: (h === 'engine') === engineOn }"
      :aria-pressed="(h === 'engine') === engineOn"
      :aria-disabled="h === 'engine' && !ready ? 'true' : undefined"
      :aria-label="i18n.t(label)"
      @mouseenter="hoverOpen($event, h)"
      @mouseleave="hoverClose"
      @focus="hoverOpen($event, h)"
      @blur="hoverClose"
      @click="press($event, h)"
      @touchstart.passive="onTouchStart"
    >
      <SlIcon :name="icon" />
    </button>
    <SlCard v-if="anchor && card" :anchor :title="card.title" :lines="card.lines" />
  </span>
</template>

<style scoped>
.sl-switch {
  display: inline-flex;
  gap: 1px;
  padding: 1px;
  border: 1px solid var(--color-border-primary);
  border-radius: 13px;
  background: var(--color-bg-secondary);
}

.sl-switch button {
  display: grid;
  place-items: center;
  width: 26px;
  height: 22px;
  padding: 0;
  border: 0;
  border-radius: 11px;
  background: none;
  color: var(--color-text-secondary);
  cursor: pointer;
}

.sl-switch button.on {
  background: var(--color-primary);
  color: #fff;
}

.sl-switch button[aria-disabled='true'] {
  opacity: 0.45;
  cursor: default;
}

.sl-switch .sl-icon {
  width: 15px;
  height: 15px;
}
</style>

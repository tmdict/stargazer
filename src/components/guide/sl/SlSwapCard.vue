<script setup lang="ts">
/* A swap tried on a board: the heroes swapped in, and the chance to win the
   map without them and with them. */

import { computed } from 'vue'

import SlCard from './SlCard.vue'
import { useI18nStore } from '@/stores/i18n'
import { interpolateParts } from '@/utils/interpolate'
import { slPercent, useSlNames } from './useSlNames'

const { into, before, after } = defineProps<{
  anchor: Pick<Element, 'getBoundingClientRect'>
  clearOf?: Pick<Element, 'getBoundingClientRect'>
  into: number[]
  before: number
  after: number
}>()

const i18n = useI18nStore()
const { cardNames } = useSlNames()

const title = computed(() =>
  interpolateParts(i18n.t('app.sl-swap-heroes'), { heroes: cardNames(into) }),
)
const lines = computed(() => [
  {
    lead: i18n.t('app.sl-explain-chance'),
    // Before and after wrap as one.
    parts: [{ text: `${slPercent(before)}\u00a0→\u00a0${slPercent(after)}` }],
  },
])
</script>

<template>
  <SlCard :anchor :clear-of :offset="6" :title :lines />
</template>

<script setup lang="ts">
/* A swap tried on a board: the heroes swapped in. */

import { computed } from 'vue'

import SlCard from './SlCard.vue'
import { useI18nStore } from '@/stores/i18n'
import { interpolateParts } from '@/utils/interpolate'
import { useSlNames } from './useSlNames'

const { into } = defineProps<{
  anchor: Pick<Element, 'getBoundingClientRect'>
  clearOf?: Pick<Element, 'getBoundingClientRect'>
  into: number[]
}>()

const i18n = useI18nStore()
const { cardNames } = useSlNames()

const title = computed(() =>
  interpolateParts(i18n.t('app.sl-swap-heroes'), { heroes: cardNames(into) }),
)
</script>

<template>
  <SlCard :anchor :clear-of :offset="6" :title />
</template>

<script setup lang="ts">
/* Says what a pick of a shop hero places on an Honor Duel board: a shop copy
   or a Trial copy. The tab's list and the popup on an empty tile both show it,
   over the one value they share. */

import { computed } from 'vue'

import SegmentedPicker from '@/components/ui/SegmentedPicker.vue'
import { useDuelUnits } from '@/composables/useDuelUnits'
import { useI18nStore } from '@/stores/i18n'

const i18n = useI18nStore()
const { trial } = useDuelUnits()

const sources = computed(() => [
  { key: 'shop', label: i18n.t('app.shop'), selected: !trial.value },
  { key: 'trial', label: i18n.t('app.trial'), selected: trial.value },
])
</script>

<template>
  <SegmentedPicker
    small
    :segments="sources"
    :aria-label="i18n.t('app.heroes')"
    @select="trial = $event === 'trial'"
  />
</template>

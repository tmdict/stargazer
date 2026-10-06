<script setup lang="ts">
/* The energy filter's control: its range, its wording and its button names in
   one place, for the hero lists and the Mechanics guide. */

import FilterStepper from './ui/FilterStepper.vue'
import { ENERGY_KEY, ENERGY_MAX, ENERGY_MIN, ENERGY_STEP, energyAboveLabel } from '@/lib/mechanics'
import type { AppLocale } from '@/lib/types/i18n'
import { interpolate } from '@/utils/interpolate'
import { appLabel, mechanicLabel } from '@/utils/skillLabels'

const { lang } = defineProps<{
  lang: AppLocale
  count?: number
  active?: boolean
  dark?: boolean
}>()

const model = defineModel<number>({ required: true })

const stepLabel = (key: string): string => interpolate(appLabel(key, lang), { n: ENERGY_STEP })
</script>

<template>
  <FilterStepper
    v-model="model"
    :min="ENERGY_MIN"
    :max="ENERGY_MAX"
    :step="ENERGY_STEP"
    :count
    :active
    :dark
    :label="mechanicLabel(ENERGY_KEY, lang)"
    :lower-label="stepLabel('energy-lower')"
    :raise-label="stepLabel('energy-raise')"
  >
    <template #default>{{ energyAboveLabel(model) }}</template>
  </FilterStepper>
</template>

<script setup lang="ts">
/* A swap tried on a board: the heroes swapped in, and the chance to win the
   map without them and with them. */

import TooltipCard from '@/components/ui/TooltipCard.vue'
import TooltipPopup from '@/components/ui/TooltipPopup.vue'
import { useI18nStore } from '@/stores/i18n'
import { slPercent, useSlNames } from './useSlNames'

defineProps<{
  anchor: Pick<Element, 'getBoundingClientRect'>
  into: number[]
  before: number
  after: number
}>()

const i18n = useI18nStore()
const { cardNames } = useSlNames()
</script>

<template>
  <Teleport to="body">
    <TooltipPopup :target-element="anchor" variant="detailed" max-width="330px">
      <template #content>
        <TooltipCard
          :name="cardNames(into)"
          :rows="[
            {
              label: i18n.t('app.sl-explain-chance'),
              value: `${slPercent(before)} → ${slPercent(after)}`,
            },
          ]"
        />
      </template>
    </TooltipPopup>
  </Teleport>
</template>

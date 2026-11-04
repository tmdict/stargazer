<script setup lang="ts">
/* A swap tried on a board: the heroes swapped in, and the chance to win the
   map without them and with them. */

import { computed } from 'vue'

import SlCardLines from './SlCardLines.vue'
import TooltipCard from '@/components/ui/TooltipCard.vue'
import TooltipPopup from '@/components/ui/TooltipPopup.vue'
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
    parts: [{ text: `${slPercent(before)} → ${slPercent(after)}` }],
  },
])
</script>

<template>
  <Teleport to="body">
    <TooltipPopup
      :target-element="anchor"
      :clear-of
      :offset="6"
      variant="detailed"
      max-width="330px"
    >
      <template #content>
        <TooltipCard>
          <template #default>
            <SlCardLines :title :lines />
          </template>
        </TooltipCard>
      </template>
    </TooltipPopup>
  </Teleport>
</template>

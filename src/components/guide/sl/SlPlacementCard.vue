<script setup lang="ts">
/* Why a unit on a board stands where it does: one line per reason, a verb
   then what it is about, then a line when the green tiles would do better and
   a last one when the dashed tiles would do as well. */

import { computed } from 'vue'

import SlCard from './SlCard.vue'
import type { PlacedEffect, PlacementReason } from '@/lib/placement/explain'
import { useI18nStore } from '@/stores/i18n'
import { interpolateParts, type TextPart } from '@/utils/interpolate'
import { localizedDisplayName } from '@/utils/nameFormatting'
import { useSlNames } from './useSlNames'

const { reasons, alsoFine, better } = defineProps<{
  anchor: Pick<Element, 'getBoundingClientRect'>
  reasons: readonly PlacementReason[]
  alsoFine: boolean
  better: boolean
}>()

const i18n = useI18nStore()
const { cardName, cardNames } = useSlNames()

const named = (text: string): TextPart[] => [{ text, marked: true }]

const giverName = ({ giver, file }: PlacedEffect): TextPart[] =>
  named(giver === undefined ? localizedDisplayName(i18n.t, 'artifact', file) : cardName(giver))

const line = (key: string, vars: Record<string, TextPart[]> = {}): TextPart[] =>
  interpolateParts(i18n.t(`app.${key}`), vars)

function partsOf(reason: PlacementReason): TextPart[] {
  switch (reason.verb) {
    case 'gives':
      return line(`placement-gives-${reason.effect.file}`, { heroes: cardNames(reason.to) })
    case 'reaches':
      return line(`placement-reaches-${reason.effect.file}`)
    case 'receives':
      return line(`placement-receives-${reason.effect.file}`, { giver: giverName(reason.effect) })
    case 'stands':
      return line(
        `placement-stands-${reason.place}`,
        reason.hero === undefined ? {} : { hero: named(cardName(reason.hero)) },
      )
  }
}

const lines = computed(() => [
  ...reasons.map((reason) => ({
    lead: i18n.t(`app.placement-${reason.verb}`),
    parts: partsOf(reason),
  })),
  ...(better
    ? [
        {
          lead: i18n.t('app.placement-stands'),
          parts: line('placement-stands-better', { better: named(i18n.t('app.placement-better')) }),
          better: true,
        },
      ]
    : []),
  ...(alsoFine
    ? [{ lead: i18n.t('app.placement-stands'), parts: line('placement-stands-also-fine') }]
    : []),
])
</script>

<template>
  <SlCard :anchor :lines />
</template>

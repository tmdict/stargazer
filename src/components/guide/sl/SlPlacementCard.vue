<script setup lang="ts">
/* Why a unit the engine placed stands where it does: one line per reason, a
   verb then what it is about, and a last line when the outlined tiles would do
   as well. */

import { computed } from 'vue'

import TooltipCard from '@/components/ui/TooltipCard.vue'
import TooltipPopup from '@/components/ui/TooltipPopup.vue'
import type { PlacedEffect, PlacementReason } from '@/lib/placement/explain'
import { useI18nStore } from '@/stores/i18n'
import { localizedDisplayName } from '@/utils/nameFormatting'
import { useSlNames } from './useSlNames'

const { reasons, alsoFine } = defineProps<{
  anchor: Pick<Element, 'getBoundingClientRect'>
  reasons: PlacementReason[]
  alsoFine: boolean
}>()

const i18n = useI18nStore()
const { cardName, cardNames } = useSlNames()

const giverName = ({ giver, file }: PlacedEffect): string =>
  giver === undefined ? localizedDisplayName(i18n.t, 'artifact', file) : cardName(giver)

function textOf(reason: PlacementReason): string {
  switch (reason.verb) {
    case 'gives':
      return i18n.t(`app.placement-gives-${reason.effect.file}`, {
        heroes: cardNames(reason.heroes),
      })
    case 'reaches':
      return i18n.t(`app.placement-reaches-${reason.effect.file}`)
    case 'receives':
      return i18n.t(`app.placement-receives-${reason.effect.file}`, {
        giver: giverName(reason.effect),
      })
    case 'stands':
      return i18n.t(
        `app.placement-stands-${reason.place}`,
        reason.hero === undefined ? undefined : { hero: cardName(reason.hero) },
      )
  }
}

const lines = computed(() => [
  ...reasons.map((reason) => ({
    verb: i18n.t(`app.placement-${reason.verb}`),
    text: textOf(reason),
  })),
  ...(alsoFine
    ? [{ verb: i18n.t('app.placement-stands'), text: i18n.t('app.placement-stands-also-fine') }]
    : []),
])
</script>

<template>
  <Teleport to="body">
    <TooltipPopup :target-element="anchor" variant="detailed" max-width="290px">
      <template #content>
        <TooltipCard>
          <template #default>
            <ul class="placement-reasons">
              <li v-for="(line, index) in lines" :key="index">
                <b>{{ line.verb }}</b> {{ line.text }}
              </li>
            </ul>
          </template>
        </TooltipCard>
      </template>
    </TooltipPopup>
  </Teleport>
</template>

<style scoped>
.placement-reasons {
  margin: 0;
  padding-left: 16px;
  color: inherit;
  font-size: inherit;
  line-height: inherit;
}

.placement-reasons li {
  margin: 0;
  color: inherit;
  font-size: inherit;
  line-height: inherit;
  opacity: 1;
}

.placement-reasons li + li {
  margin-top: 5px;
}

.placement-reasons li::marker {
  color: var(--tooltip-muted);
}

.placement-reasons b {
  font-weight: 600;
}
</style>

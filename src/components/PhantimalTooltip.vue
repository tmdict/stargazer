<script setup lang="ts">
/* Hover card for a phantimal, shared by the phantimal picker and the placed
   grid icons (GridCharacters). The caller decides when to show it, supplies the
   anchor element, and adds any rows of its own after the phantimal's. */

import { computed } from 'vue'

import TooltipCard from './ui/TooltipCard.vue'
import TooltipPopup from './ui/TooltipPopup.vue'
import { useUnitTooltipRows } from '@/composables/useUnitTooltipRows'
import type { PhantimalType } from '@/lib/types/phantimal'
import { useI18nStore } from '@/stores/i18n'
import { phantimalDisplayName } from '@/utils/nameFormatting'

const { phantimal, extraRows = [] } = defineProps<{
  phantimal: PhantimalType
  targetElement: Element
  extraRows?: { label: string; value: string }[]
  hint?: string
}>()

const i18n = useI18nStore()
const { traitRow, rangeRow } = useUnitTooltipRows()

const name = computed(() => phantimalDisplayName(i18n.currentLocale, phantimal.name))

const rows = computed(() => [
  traitRow('faction', phantimal.faction),
  traitRow('class', phantimal.class),
  traitRow('damage', phantimal.damage),
  rangeRow(phantimal.range),
  ...extraRows,
])
</script>

<template>
  <Teleport to="body">
    <TooltipPopup :target-element variant="detailed">
      <template #content>
        <TooltipCard :name :rows :hint />
      </template>
    </TooltipPopup>
  </Teleport>
</template>

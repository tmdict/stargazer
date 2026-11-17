<script setup lang="ts">
/* Hover card for an Honor Duel item: its name and its effect, an artifact's
   at one level. The caller decides when to show it and supplies the anchor
   element and the item's text, where the data pack holds it. */

import { computed } from 'vue'

import DuelEffectText from './DuelEffectText.vue'
import TooltipCard from '@/components/ui/TooltipCard.vue'
import TooltipPopup from '@/components/ui/TooltipPopup.vue'
import { duelItemName, duelLevelText } from '@/lib/hd/catalog'
import type { DuelArtifactText, DuelEquipmentText, HonorDuelItem } from '@/lib/types/honorDuel'
import { useI18nStore } from '@/stores/i18n'

const {
  item,
  text,
  level = 1,
} = defineProps<{
  item: HonorDuelItem
  targetElement: Element
  text?: DuelEquipmentText | DuelArtifactText
  // The artifact level whose effect shows.
  level?: number
}>()

const i18n = useI18nStore()

const name = computed(() => text?.name || duelItemName(item, i18n.currentLocale))

const effect = computed(
  () => text && ('levels' in text ? duelLevelText(text, level) : text.description),
)
</script>

<template>
  <TooltipPopup :target-element>
    <template #content>
      <TooltipCard :name>
        <DuelEffectText v-if="effect" :source="effect" />
      </TooltipCard>
    </template>
  </TooltipPopup>
</template>

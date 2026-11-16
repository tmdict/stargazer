<script setup lang="ts">
/* Hover card for an Honor Duel item: its name and its effect, an artifact's
   at level 1. The caller decides when to show it and supplies the anchor
   element and the item's text, where the data pack holds it. */

import { computed } from 'vue'

import TooltipCard from '@/components/ui/TooltipCard.vue'
import TooltipPopup from '@/components/ui/TooltipPopup.vue'
import { duelItemName } from '@/lib/hd/catalog'
import type { DuelArtifactText, DuelEquipmentText, HonorDuelItem } from '@/lib/types/honorDuel'
import { useI18nStore } from '@/stores/i18n'
import { HIGHLIGHT_RE, splitHighlightToken } from '@/utils/textHighlight'

const { item, text } = defineProps<{
  item: HonorDuelItem
  targetElement: Element
  text?: DuelEquipmentText | DuelArtifactText
}>()

const i18n = useI18nStore()

const name = computed(() => text?.name || duelItemName(item, i18n.currentLocale))

// The effect as plain and marked runs: the card draws a marked value in bold
// without the popup's value colour or keyword links.
const effect = computed(() => {
  const source = text && ('levels' in text ? text.levels[0] : text.description)
  if (!source) return []
  return source.split(HIGHLIGHT_RE).map((part, index) => ({
    value: index % 2 === 1 ? splitHighlightToken(part).label : part,
    marked: index % 2 === 1,
  }))
})
</script>

<template>
  <TooltipPopup :target-element>
    <template #content>
      <TooltipCard :name>
        <div v-if="effect.length" class="duel-effect">
          <template v-for="(run, index) in effect" :key="index"
            ><b v-if="run.marked">{{ run.value }}</b
            ><template v-else>{{ run.value }}</template></template
          >
        </div>
      </TooltipCard>
    </template>
  </TooltipPopup>
</template>

<style scoped>
.duel-effect {
  line-height: 1.45;
  white-space: pre-line;
}
</style>

<script setup lang="ts">
import BuffTileText from './BuffTileText.vue'
import TooltipCard from '@/components/ui/TooltipCard.vue'
import TooltipPopup from '@/components/ui/TooltipPopup.vue'
import { useI18nStore } from '@/stores/i18n'

defineProps<{
  buff: string
  targetElement: Element
}>()

const i18n = useI18nStore()
</script>

<template>
  <TooltipPopup :target-element>
    <template #content>
      <TooltipCard :name="i18n.t('app.buff-tile')" :hint="i18n.t('app.turn-off-buff-tiles')">
        <BuffTileText :buff />
      </TooltipCard>
    </template>
  </TooltipPopup>
</template>

<script setup lang="ts">
/* Hover tooltip for an artifact, shared by the picker icon (ArtifactIcon) and the
   placed grid icons (GridArtifacts). The caller decides when to show it and supplies
   the anchor element; this owns the popup body (name only, or name + stats). */

import { computed } from 'vue'

import TooltipCard from './ui/TooltipCard.vue'
import TooltipPopup from './ui/TooltipPopup.vue'
import type { ArtifactType } from '@/lib/types/artifact'
import { useI18nStore } from '@/stores/i18n'
import { formatArtifactStats } from '@/utils/artifactStats'
import { localizedDisplayName } from '@/utils/nameFormatting'

const { artifact, variant = 'detailed' } = defineProps<{
  artifact: ArtifactType
  targetElement: HTMLElement
  variant?: 'simple' | 'detailed'
  hint?: string
}>()

const i18n = useI18nStore()

const formattedName = computed(() => localizedDisplayName(i18n.t, 'artifact', artifact.name))
const rows = computed(() => [
  { label: `${i18n.t('game.season')}:`, value: artifact.season },
  ...formatArtifactStats(artifact.stats, i18n.currentLocale).map((stat) => ({
    label: `${stat.label}:`,
    value: stat.value,
  })),
])
</script>

<template>
  <Teleport to="body">
    <TooltipPopup :target-element="targetElement" :variant="variant">
      <template #content>
        <div v-if="variant === 'simple'" class="simple-tooltip">{{ formattedName }}</div>
        <TooltipCard v-else :name="formattedName" :rows :hint />
      </template>
    </TooltipPopup>
  </Teleport>
</template>

<style scoped>
.simple-tooltip {
  font-weight: 600;
  text-align: center;
  white-space: nowrap;
}
</style>

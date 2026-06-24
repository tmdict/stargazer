<script setup lang="ts">
/* Hover tooltip for an artifact, shared by the roster icon (ArtifactIcon) and the
   placed grid icons (GridArtifacts). The caller decides when to show it and supplies
   the anchor element; this owns the popup body (name only, or name + stats). */

import { computed } from 'vue'

import TooltipPopup from './ui/TooltipPopup.vue'
import type { ArtifactType } from '@/lib/types/artifact'
import { useI18nStore } from '@/stores/i18n'
import { formatArtifactStats } from '@/utils/artifactStats'
import { localizedDisplayName } from '@/utils/nameFormatting'

const { artifact, variant = 'detailed' } = defineProps<{
  artifact: ArtifactType
  targetElement: HTMLElement
  variant?: 'simple' | 'detailed'
}>()

const i18n = useI18nStore()

const formattedName = computed(() => localizedDisplayName(i18n.t, 'artifact', artifact.name))
const formattedStats = computed(() => formatArtifactStats(artifact.stats, i18n.currentLocale))
</script>

<template>
  <Teleport to="body">
    <TooltipPopup :target-element="targetElement" :variant="variant" :offset="10">
      <template #content>
        <div v-if="variant === 'simple'" class="simple-tooltip">{{ formattedName }}</div>

        <template v-else>
          <div class="tooltip-header">
            <div class="tooltip-name">{{ formattedName }}</div>
          </div>
          <div class="tooltip-info">
            <div class="tooltip-row">
              <span class="tooltip-label">{{ i18n.t('game.season') }}:</span>
              <span class="tooltip-value">{{ artifact.season }}</span>
            </div>
            <div v-for="stat in formattedStats" :key="stat.key" class="tooltip-row">
              <span class="tooltip-label">{{ stat.label }}:</span>
              <span class="tooltip-value">{{ stat.value }}</span>
            </div>
          </div>
        </template>
      </template>
    </TooltipPopup>
  </Teleport>
</template>

<style scoped>
.simple-tooltip {
  font-size: 14px;
  font-weight: 600;
  text-align: center;
  white-space: nowrap;
}

.tooltip-header {
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.tooltip-name {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 4px;
}

.tooltip-info {
  display: grid;
  grid-template-columns: max-content 1fr;
  column-gap: 16px;
  row-gap: 6px;
  font-size: 13px;
}

.tooltip-row {
  display: contents;
}

.tooltip-label {
  color: rgba(255, 255, 255, 0.7);
}

.tooltip-value {
  font-weight: 500;
}
</style>

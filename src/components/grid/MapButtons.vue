<script setup lang="ts">
/* A board's map as one strip of buttons after the word "Map". */

import SegmentedPicker, { type Segment } from '@/components/ui/SegmentedPicker.vue'
import { useI18nStore } from '@/stores/i18n'

defineProps<{
  maps: readonly Segment[]
  // Narrower buttons on a phone, for a strip too long for its width.
  dense?: boolean
}>()

const emit = defineEmits<{ select: [map: string] }>()

const i18n = useI18nStore()
</script>

<template>
  <div class="map-buttons" :class="{ dense }">
    <span class="map-label" aria-hidden="true">{{ i18n.t('app.map') }}</span>
    <SegmentedPicker
      small
      :segments="maps"
      :aria-label="i18n.t('app.map')"
      @select="emit('select', $event)"
    />
  </div>
</template>

<style scoped>
.map-buttons {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--spacing-sm);
}

.map-label {
  color: var(--color-text-secondary);
  font-size: var(--control-font-size);
  font-weight: var(--control-font-weight);
}

@media (max-width: 480px) {
  .map-buttons.dense {
    --segment-inline-padding: 6px;
  }
}
</style>

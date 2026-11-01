<script lang="ts">
// Where the boards' heroes stand: as recorded, or in the engine's formation.
export type SlFormation = 'recorded' | 'suggested'
</script>

<script setup lang="ts">
import { computed } from 'vue'

import SegmentedPicker from '@/components/ui/SegmentedPicker.vue'
import { useI18nStore } from '@/stores/i18n'

const { formation } = defineProps<{ formation: SlFormation }>()

const emit = defineEmits<{ select: [formation: SlFormation] }>()

const i18n = useI18nStore()

const segments = computed(() =>
  (
    [
      ['recorded', i18n.t('app.sl-formation-recorded')],
      ['suggested', i18n.t('app.sl-formation-suggested')],
    ] as const
  ).map(([key, label]) => ({ key, label, selected: key === formation })),
)
</script>

<template>
  <SegmentedPicker
    :segments
    :aria-label="i18n.t('app.sl-formation')"
    @select="emit('select', $event)"
  />
</template>

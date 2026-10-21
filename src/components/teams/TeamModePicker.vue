<script setup lang="ts">
/* Segmented team-mode picker. Each mode keeps its own persisted boards, so
   switching is lossless. */

import { computed } from 'vue'

import SegmentedPicker from './SegmentedPicker.vue'
import { TEAM_MODE_ORDER, TEAM_MODES, type TeamModeKey } from '@/lib/teams/modes'
import { useI18nStore } from '@/stores/i18n'

const { activeMode } = defineProps<{
  activeMode: TeamModeKey
}>()

const emit = defineEmits<{
  switchMode: [mode: TeamModeKey]
}>()

const i18n = useI18nStore()

const segments = computed(() =>
  TEAM_MODE_ORDER.map((key) => ({
    key,
    label: i18n.t(TEAM_MODES[key].labelKey),
    selected: activeMode === key,
  })),
)
</script>

<template>
  <SegmentedPicker
    :segments
    :aria-label="i18n.t('app.teams')"
    @select="emit('switchMode', $event)"
  />
</template>

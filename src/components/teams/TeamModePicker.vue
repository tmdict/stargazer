<script setup lang="ts">
/* Segmented team-mode picker. Each mode keeps its own persisted boards, so
   switching is lossless. */

import { computed } from 'vue'

import SegmentedPicker from '@/components/ui/SegmentedPicker.vue'
import { TEAM_MODE_ORDER, TEAM_MODES, type TeamModeKey } from '@/lib/teams/modes'
import type { AppLocale } from '@/lib/types/i18n'
import { useI18nStore } from '@/stores/i18n'
import { appKeyLabel } from '@/utils/skillLabels'

const { activeMode, lang } = defineProps<{
  activeMode: TeamModeKey
  // A picture of the picker names its options in the picture's language.
  lang?: AppLocale
}>()

const emit = defineEmits<{
  switchMode: [mode: TeamModeKey]
}>()

const i18n = useI18nStore()
const label = (key: string): string => (lang ? appKeyLabel(key, lang) : i18n.t(key))

const segments = computed(() =>
  TEAM_MODE_ORDER.map((key) => ({
    key,
    label: label(TEAM_MODES[key].labelKey),
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

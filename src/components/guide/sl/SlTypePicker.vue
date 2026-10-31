<script setup lang="ts">
import { computed } from 'vue'

import SegmentedPicker from '@/components/ui/SegmentedPicker.vue'
import { SL_SET_TYPES, type SlSetType } from '@/lib/pvp/sl/generator/setType'
import { TEAM_MODES, TEAM_VARIANTS } from '@/lib/teams/modes'
import { useI18nStore } from '@/stores/i18n'

const { type } = defineProps<{ type: SlSetType }>()

const emit = defineEmits<{ select: [type: SlSetType] }>()

const i18n = useI18nStore()

const segments = computed(() =>
  SL_SET_TYPES.map((key) => ({
    key,
    label: i18n.t((key === 'sl' ? TEAM_VARIANTS[key] : TEAM_MODES[key]).labelKey),
    selected: key === type,
  })),
)
</script>

<template>
  <SegmentedPicker :segments :aria-label="i18n.t('app.type')" @select="emit('select', $event)" />
</template>

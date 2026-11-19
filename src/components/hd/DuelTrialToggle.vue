<script setup lang="ts">
/* A unit's Trial mark: the word's first character in a disc on a Trial copy.
   Unless `fixed`, it is a button that asks to change the hero between its
   normal and its Trial copy, and an empty slot on the normal one. The host
   sets the size (--badge-size, --badge-border). */

import { computed } from 'vue'

import DuelSlot from './DuelSlot.vue'
import UnitBadge from '@/components/grid/UnitBadge.vue'
import type { AppLocale } from '@/lib/types/i18n'
import { useI18nStore } from '@/stores/i18n'
import { initialOf } from '@/utils/nameFormatting'
import { appLabel } from '@/utils/skillLabels'

const { lang } = defineProps<{
  trial: boolean
  fixed?: boolean
  // A picture of the mark names it in the picture's language.
  lang?: AppLocale
}>()

const emit = defineEmits<{ toggle: [] }>()

const i18n = useI18nStore()

const label = computed(() => (lang ? appLabel('trial', lang) : i18n.t('app.trial')))
</script>

<template>
  <DuelSlot
    v-if="trial || !fixed"
    :label
    :empty="!trial"
    :readonly="fixed"
    :aria-pressed="fixed ? undefined : trial"
    @press="emit('toggle')"
  >
    <UnitBadge :plain="!trial" :color="trial ? 'var(--duel-trial-mark)' : undefined">
      {{ initialOf(label) }}
    </UnitBadge>
  </DuelSlot>
</template>

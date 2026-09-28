<script setup lang="ts">
/* Reset / +1 / max chips for bulk upgrade edits; the owner decides which
   heroes and layers they change. Rendered without a wrapper so the chips are
   the owner's own flex items (the board dock mirrors its enemy cluster). */

import IconChevronsUp from './IconChevronsUp.vue'
import IconReset from './IconReset.vue'
import UpgradeDockChip from './UpgradeDockChip.vue'
import { useI18nStore } from '@/stores/i18n'

defineProps<{ canReset: boolean; canRaise: boolean }>()

const emit = defineEmits<{ reset: []; raise: []; max: [] }>()

const i18n = useI18nStore()
</script>

<template>
  <UpgradeDockChip :tip="i18n.t('app.reset-upgrades')" :disabled="!canReset" @click="emit('reset')">
    <IconReset :size="11" />
  </UpgradeDockChip>
  <UpgradeDockChip :tip="i18n.t('app.raise-upgrades')" :disabled="!canRaise" @click="emit('raise')">
    +1
  </UpgradeDockChip>
  <UpgradeDockChip :tip="i18n.t('app.max-upgrades')" :disabled="!canRaise" @click="emit('max')">
    <IconChevronsUp :size="11" />
  </UpgradeDockChip>
</template>

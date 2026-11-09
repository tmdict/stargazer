<script setup lang="ts">
/* The popup about the move: the new address, what a hand-over brought or why
   it could not, and the ways to fetch data still at the old address. */

import BaseModal from './BaseModal.vue'
import { MOVE_STAGE, RECOVERY_URL, type HandOverResult } from '@/lib/move/config'
import { useI18nStore } from '@/stores/i18n'

defineProps<{
  show: boolean
  result: HandOverResult | null
}>()

const emit = defineEmits<{ close: []; bring: [] }>()

const i18n = useI18nStore()
</script>

<template>
  <BaseModal :show :label="i18n.t('app.move-title')" @close="emit('close')">
    <h2>{{ i18n.t('app.move-title') }}</h2>
    <p>{{ i18n.t('app.move-welcome') }}</p>

    <template v-if="result?.ok">
      <p>{{ i18n.t('app.move-arrived', { teams: result.teams, rosters: result.rosters }) }}</p>
      <p v-if="result.teamsLeft || result.rostersLeft">
        {{ i18n.t('app.move-left', { teams: result.teamsLeft, rosters: result.rostersLeft }) }}
      </p>
    </template>
    <p v-else-if="result">{{ i18n.t('app.move-failed') }}</p>

    <template v-if="MOVE_STAGE === 2 && !result?.ok">
      <p v-if="!result">{{ i18n.t('app.move-bring-hint') }}</p>
      <p>
        <button type="button" class="solid-btn move-bring" @click="emit('bring')">
          {{ i18n.t('app.move-bring') }}
        </button>
      </p>
    </template>

    <p>
      <a :href="RECOVERY_URL" target="_blank" rel="noopener">{{ i18n.t('app.move-download') }}</a>
    </p>
    <p class="reading-secondary">{{ i18n.t('app.move-download-hint') }}</p>
  </BaseModal>
</template>

<style scoped>
.move-bring {
  padding: var(--spacing-sm) var(--spacing-lg);
  font-size: inherit;
}
</style>

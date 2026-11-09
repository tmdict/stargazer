<script setup lang="ts">
/* The popup about the move: the new address, what a hand-over brought or why
   it could not, and the ways to fetch data still at the old address. */

import { computed } from 'vue'

import BaseModal from './BaseModal.vue'
import { MOVE_STAGE, RECOVERY_URL, type HandOverResult } from '@/lib/move/config'
import { SITE_HOST } from '@/lib/site'
import { useI18nStore } from '@/stores/i18n'

const props = defineProps<{
  show: boolean
  result: HandOverResult | null
}>()

const emit = defineEmits<{ close: []; bring: [] }>()

const i18n = useI18nStore()

const welcome = computed(() => i18n.t('app.move-welcome').split('{site}'))

// "12 saved teams, 3 rosters": a kind with none is left out.
const counted = (teams: number, rosters: number, joiner: string): string =>
  [
    teams ? i18n.t(teams === 1 ? 'app.move-count-team' : 'app.move-count-teams', { n: teams }) : '',
    rosters
      ? i18n.t(rosters === 1 ? 'app.move-count-roster' : 'app.move-count-rosters', { n: rosters })
      : '',
  ]
    .filter(Boolean)
    .join(i18n.t(joiner))

const leftList = computed(() =>
  props.result
    ? counted(props.result.teamsLeft, props.result.rostersLeft, 'app.move-list-and')
    : '',
)
const left = computed(() => leftList.value !== '')
const arrivedList = computed(() =>
  props.result
    ? counted(
        props.result.teams,
        props.result.rosters,
        left.value ? 'app.move-list-and' : 'app.move-list-comma',
      )
    : '',
)

// The files are for data a hand-over left behind. Before any hand-over they
// are offered as a backup only while the old address still serves its pages;
// after that the one-click transfer comes first.
const filesOffered = computed(() =>
  props.result ? !props.result.ok || left.value : MOVE_STAGE === 1,
)
</script>

<template>
  <BaseModal :show :label="i18n.t('app.move-title')" @close="emit('close')">
    <h2>{{ i18n.t('app.move-title') }}</h2>
    <p>
      {{ welcome[0] }}<b>{{ SITE_HOST }}</b
      >{{ welcome[1] }}
    </p>

    <template v-if="result?.ok">
      <p v-if="arrivedList">
        {{ i18n.t(left ? 'app.move-arrived-part' : 'app.move-arrived', { list: arrivedList }) }}
      </p>
      <p v-else-if="!left">{{ i18n.t('app.move-arrived-none') }}</p>
      <p v-if="left">{{ i18n.t('app.move-left', { list: leftList }) }}</p>
    </template>
    <p v-else-if="result">{{ i18n.t('app.move-failed') }}</p>
    <p v-else-if="MOVE_STAGE === 1">{{ i18n.t('app.move-backup') }}</p>

    <template v-if="MOVE_STAGE === 2 && !result?.ok">
      <p v-if="!result">{{ i18n.t('app.move-bring-hint') }}</p>
      <p>
        <button type="button" class="solid-btn move-bring" @click="emit('bring')">
          {{ i18n.t('app.move-bring') }}
        </button>
      </p>
    </template>

    <template v-if="filesOffered">
      <p>
        <a :href="RECOVERY_URL" target="_blank" rel="noopener">{{ i18n.t('app.move-download') }}</a>
      </p>
      <p class="reading-secondary">{{ i18n.t('app.move-download-hint') }}</p>
    </template>
  </BaseModal>
</template>

<style scoped>
.move-bring {
  padding: var(--spacing-sm) var(--spacing-lg);
  font-size: inherit;
}
</style>

<script setup lang="ts">
/* The popup about the move: the new address, what a hand-over brought or why
   it could not, and the ways to fetch data still at the old address. What a
   full hand-over brought is told once, in the popup that opens as it arrives;
   opened from the banner, the popup offers the hand-over again. */

import { computed } from 'vue'

import BaseModal from './BaseModal.vue'
import { RECOVERY_URL, type HandOverResult } from '@/lib/move/config'
import { SITE_HOST } from '@/lib/site'
import { useI18nStore } from '@/stores/i18n'

const props = defineProps<{
  show: boolean
  result: HandOverResult | null
  onArrival: boolean
  requested: boolean
}>()

const emit = defineEmits<{ close: []; bring: [] }>()

const i18n = useI18nStore()

const welcome = computed(() => i18n.t('app.move-welcome').split('{site}'))

// The answer to the popup's own button comes back seconds after its welcome,
// so it is the result alone, under the button's name.
const answer = computed(() => props.onArrival && props.requested)
const title = computed(() => i18n.t(answer.value ? 'app.move-bring' : 'app.move-title'))

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

// The files are for data a hand-over left behind.
const filesOffered = computed(() => !!props.result && (!props.result.ok || left.value))

// A full library has no room for another hand-over, and the popup that tells
// what arrived has nothing more to bring.
const bringOffered = computed(() => !props.result?.ok || (!props.onArrival && !left.value))
</script>

<template>
  <BaseModal :show :label="title" @close="emit('close')">
    <h2>{{ title }}</h2>
    <p v-if="!answer">
      {{ welcome[0] }}<b>{{ SITE_HOST }}</b
      >{{ welcome[1] }}
    </p>

    <template v-if="result?.ok && (left || onArrival)">
      <p v-if="arrivedList">
        {{ i18n.t(left ? 'app.move-arrived-part' : 'app.move-arrived', { list: arrivedList }) }}
      </p>
      <p v-else-if="!left">{{ i18n.t('app.move-arrived-none') }}</p>
      <p v-if="left">{{ i18n.t('app.move-left', { list: leftList }) }}</p>
    </template>
    <p v-else-if="result && !result.ok">{{ i18n.t('app.move-failed') }}</p>

    <template v-if="bringOffered">
      <p v-if="!result || result.ok">{{ i18n.t('app.move-bring-hint') }}</p>
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

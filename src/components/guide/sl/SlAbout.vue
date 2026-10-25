<script setup lang="ts">
/* The note on the data: the teams are real ones from the season's records,
   how many, the season's report for more, how the records trail new heroes,
   and credit to the content creators many of the teams start with. */

import { computed } from 'vue'

import BaseModal from '@/components/modals/BaseModal.vue'
import type { SlSample } from '@/lib/pvp/sl/types'
import { pvpReportHref } from '@/lib/pvp/summary'
import { useI18nStore } from '@/stores/i18n'

const { season, sample, before } = defineProps<{
  show: boolean
  season: number
  date: string
  sample: SlSample | null
  before: (SlSample & { season: number }) | null
}>()

const emit = defineEmits<{ close: [] }>()

const CREATORS = [
  { name: 'Puzzle', site: 'YouTube', url: 'https://www.youtube.com/@PuzzleAFKJ' },
  { name: 'elfe', site: 'YouTube', url: 'https://www.youtube.com/@ElfeYT/' },
  { name: '剑圣', site: 'bilibili', url: 'https://space.bilibili.com/36938510' },
  { name: '北城', site: 'bilibili', url: 'https://space.bilibili.com/3546868856392100' },
  { name: '贝姬', site: 'bilibili', url: 'https://space.bilibili.com/3546739751520445' },
]

const i18n = useI18nStore()

const counts = (s: SlSample): Record<string, string> => {
  const format = new Intl.NumberFormat(i18n.currentLocale)
  return {
    matches: format.format(s.matches),
    games: format.format(s.games),
    players: format.format(s.players),
  }
}

// The sentence around the report's link, which takes the place of {report}.
const SLOT = '\u0000'
const reportText = computed(() => i18n.t('app.sl-about-report', { report: SLOT }).split(SLOT))
const reportHref = computed(() => pvpReportHref(season, i18n.currentLocale))
</script>

<template>
  <BaseModal :show :label="i18n.t('app.sl-about-title')" max-width="1000px" @close="emit('close')">
    <h1>{{ i18n.t('app.sl-about-title') }}</h1>
    <p>{{ i18n.t('app.sl-about-real') }}</p>
    <p v-if="sample">
      {{ i18n.t('app.sl-about-sample', { season, date, ...counts(sample) }) }}
    </p>
    <p v-if="before">
      {{ i18n.t('app.sl-about-before', { season: before.season, ...counts(before) }) }}
    </p>
    <p>
      {{ reportText[0]
      }}<a :href="reportHref" target="_blank" rel="noopener">{{
        i18n.t('app.sl-about-report-link', { season })
      }}</a
      >{{ reportText[1] }}
    </p>

    <h2>{{ i18n.t('app.sl-about-meta-head') }}</h2>
    <p>{{ i18n.t('app.sl-about-meta') }}</p>

    <h2>{{ i18n.t('app.sl-about-credit-head') }}</h2>
    <p>{{ i18n.t('app.sl-about-credit') }}</p>
    <p>{{ i18n.t('app.sl-about-thanks') }}</p>
    <ul class="sl-creators">
      <li v-for="creator in CREATORS" :key="creator.url">
        <a :href="creator.url" target="_blank" rel="noopener noreferrer">{{ creator.name }}</a>
        <span class="reading-meta">{{ creator.site }}</span>
      </li>
    </ul>
  </BaseModal>
</template>

<style scoped>
.sl-creators .reading-meta {
  margin-left: 6px;
}
</style>

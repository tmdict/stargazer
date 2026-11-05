<script setup lang="ts">
/* The note on a Supreme League page's data: where its records come from and
   what they are slow to show, and on the generator, credit for its teams and
   creators to follow for new ones. */

import { computed } from 'vue'

import BaseModal from '@/components/modals/BaseModal.vue'
import type { SlSample, SlSeason } from '@/lib/pvp/data/types'
import { pvpReportHref } from '@/lib/pvp/summary'
import { useI18nStore } from '@/stores/i18n'
import { textGap } from '@/utils/skillLabels'

const { page, date, seasons } = defineProps<{
  show: boolean
  page: 'sl' | 'www'
  date: string
  // The live season first.
  seasons: SlSeason[]
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

// Small counts stay exact so an early season never reads "0+".
const roughly = (n: number, step: number): number => (n < step ? n : Math.floor(n / step) * step)

const counts = (s: SlSample): Record<string, string> => {
  const format = new Intl.NumberFormat(i18n.currentLocale)
  return {
    matches: format.format(roughly(s.matches, 50)),
    games: format.format(roughly(s.games, 50)),
    players: format.format(roughly(s.players, 10)),
  }
}

// The sentence around the report's link, which takes the place of {report}.
const SLOT = '\u0000'
const reportText = computed(() => i18n.t('app.sl-about-report', { report: SLOT }).split(SLOT))
const season = computed(() => seasons[0]!.season)
const reportHref = computed(() => pvpReportHref(season.value, i18n.currentLocale))

const lead = computed(() => {
  const [live, ...earlier] = seasons
  return [
    i18n.t(`app.${page}-about-sample`, { season: live!.season, date, ...counts(live!.sample) }),
    ...earlier.map((s) =>
      i18n.t('app.sl-about-earlier', {
        season: s.season,
        share: Math.round(s.weight * 100),
        ...counts(s.sample),
      }),
    ),
    reportText.value[0],
  ].join(textGap(i18n.currentLocale))
})
</script>

<template>
  <BaseModal :show :label="i18n.t('app.sl-about-title')" @close="emit('close')">
    <h1>{{ i18n.t('app.sl-about-title') }}</h1>
    <p>
      {{ lead
      }}<a :href="reportHref" target="_blank" rel="noopener">{{
        i18n.t('app.sl-about-report-link', { season })
      }}</a
      >{{ reportText[1] }}
    </p>

    <h2>{{ i18n.t(`app.${page}-about-meta-head`) }}</h2>
    <p>{{ i18n.t(`app.${page}-about-meta`) }}</p>

    <template v-if="page === 'sl'">
      <h2>{{ i18n.t('app.sl-about-credit-head') }}</h2>
      <p>{{ i18n.t('app.sl-about-credit') }}</p>
      <ul class="sl-creators">
        <li v-for="creator in CREATORS" :key="creator.url">
          <a :href="creator.url" target="_blank" rel="noopener noreferrer">{{ creator.name }}</a>
          <span class="reading-meta">{{ creator.site }}</span>
        </li>
      </ul>
    </template>
  </BaseModal>
</template>

<style scoped>
.sl-creators .reading-meta {
  margin-left: 6px;
}
</style>

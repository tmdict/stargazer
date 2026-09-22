<script setup lang="ts">
/* The guide index's report entries: one block per finished season, newest
   first, each linking to its static report with the season's most played
   team groups as chips. */

import GuidePortrait from '@/components/guide/GuidePortrait.vue'
import IconChevronRight from '@/components/ui/IconChevronRight.vue'
import { mostPlayedTeams, pvpReportHref } from '@/lib/pvp/summary'
import type { AppLocale } from '@/lib/types/i18n'
import type { PvpSeasonSummary } from '@/lib/types/pvp'
import { interpolate } from '@/utils/interpolate'
import { appLabel } from '@/utils/skillLabels'

const props = defineProps<{ seasons: readonly PvpSeasonSummary[]; lang: AppLocale }>()

const CHIP_COUNT = 6

const label = (key: string): string => appLabel(key, props.lang)
const title = (season: number): string =>
  `${interpolate(label('season'), { n: season })} ${label('pvp-report')}`
</script>

<template>
  <article class="container guide-panel">
    <div class="content">
      <section v-for="summary in seasons" :key="summary.season" class="season guide-link">
        <a class="guide-title" :href="pvpReportHref(summary.season)">
          <h2>{{ title(summary.season) }}</h2>
          <IconChevronRight :size="18" />
        </a>
        <p class="guide-blurb">{{ label('pvp-report-blurb') }}</p>
        <div class="chips">
          <a
            v-for="team in mostPlayedTeams(summary, CHIP_COUNT)"
            :key="team.id"
            class="chip"
            :href="`${pvpReportHref(summary.season)}#comps`"
          >
            <span class="stack">
              <GuidePortrait v-for="slug in team.heroes" :key="slug" :slug :lang :size="24" />
            </span>
            {{ team.name }}
          </a>
        </div>
      </section>
    </div>
  </article>
</template>

<style scoped>
.season + .season {
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
}

.chip {
  position: relative;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 3px 10px 3px 5px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  text-decoration: none;
  transition: border-color 0.15s;
}
.chip:hover {
  border-color: color-mix(in srgb, var(--color-accent) 50%, transparent);
  color: #fff;
  text-decoration: none;
}

.stack {
  display: inline-flex;
  padding-left: 2px;
}
.stack .disc + .disc {
  margin-left: -7px;
}
</style>

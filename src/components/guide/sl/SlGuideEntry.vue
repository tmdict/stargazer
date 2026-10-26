<script setup lang="ts">
/* The Supreme League generator's card on the guide index: the first three maps
   of the set the generator gives before a roster is picked, drawn by its own
   map column. Each map keeps its first swap and two heroes to swap in, so the
   three fit a phone. */

import { RouterLink } from 'vue-router'
import preview from 'virtual:sl-preview'

import SlMapColumn from './SlMapColumn.vue'
import IconChevronRight from '@/components/ui/IconChevronRight.vue'
import { SL_GENERATOR_PATH } from '@/lib/guide'
import { teamPreviewBoards } from '@/lib/teams/preview'
import type { AppLocale } from '@/lib/types/i18n'
import { appLabel } from '@/utils/skillLabels'

const { lang } = defineProps<{ lang: AppLocale }>()

const MAPS = 3
const OPTIONS = 2

const boards = preview ? (teamPreviewBoards(preview.data) ?? []) : []
const maps = (preview?.teams ?? []).slice(0, MAPS).map((team, index) => {
  const [flex] = team.flex
  const [pair] = team.pairs
  return {
    board: boards[index],
    team: {
      map: team.map,
      comp: null,
      core: team.core,
      flex: flex ? [{ out: flex.out, options: flex.options.slice(0, OPTIONS) }] : [],
      pairs: !flex && pair ? [{ out: pair.out, options: pair.options.slice(0, 1) }] : [],
    },
  }
})
</script>

<template>
  <article class="container page-panel guide-panel">
    <section class="content guide-link">
      <RouterLink class="guide-title" :to="SL_GENERATOR_PATH">
        <h2>{{ appLabel('sl-title', lang) }}</h2>
        <IconChevronRight :size="18" />
      </RouterLink>
      <p class="guide-blurb">{{ appLabel('sl-blurb', lang) }}</p>
      <!-- In the generator's board colours, which its page keeps in both looks. -->
      <div v-if="maps.length" class="maps" data-theme="dark">
        <SlMapColumn
          v-for="{ team, board } in maps"
          :key="team.map"
          :team
          :board
          :numbered="false"
        />
      </div>
    </section>
  </article>
</template>

<style scoped>
.maps {
  --pt: 18px;
  --pt-gap: 4px;
  --sl-scale: 0.5;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 116px));
  justify-content: space-between;
  column-gap: 12px;
  margin-top: 14px;
}
</style>

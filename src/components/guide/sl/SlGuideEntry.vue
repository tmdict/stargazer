<script setup lang="ts">
/* The PvP team generator's card on the guide index: the first three maps
   of an example set, drawn by the generator's own map column. Each map keeps
   its first swap and two heroes to swap in, so the three fit a phone. The
   maps fill the card at the generator's proportions, up to its own size:
   there, at 1280px, a column is 220 of its pixels wide with 34px portraits
   8px apart and 24px between columns, so one of its pixels is a 220th of a
   column here, and never more than 1px. */

import SlBeta from './SlBeta.vue'
import SlMapColumn from './SlMapColumn.vue'
import LinkHeading from '@/components/ui/LinkHeading.vue'
import { SL_PREVIEW } from '@/content/pvp/slPreview'
import { SL_GENERATOR_PATH } from '@/lib/guide'
import { teamPreviewBoards } from '@/lib/teams/preview'
import type { AppLocale } from '@/lib/types/i18n'
import { appLabel } from '@/utils/skillLabels'

const { lang } = defineProps<{ lang: AppLocale }>()

const MAPS = 3
const OPTIONS = 2

const boards = teamPreviewBoards(SL_PREVIEW.data) ?? []
const maps = SL_PREVIEW.teams.slice(0, MAPS).map((team, index) => {
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
    <section class="content link-area">
      <LinkHeading :to="SL_GENERATOR_PATH">
        {{ appLabel('sl-title', lang) }}<SlBeta in-link />
      </LinkHeading>
      <p class="guide-blurb">{{ appLabel('sl-blurb', lang) }}</p>
      <!-- In the generator's board colours, which its page keeps in both looks. -->
      <div v-if="maps.length" class="maps" data-theme="dark">
        <SlMapColumn v-for="{ team, board } in maps" :key="team.map" :team :board :counts="false" />
      </div>
    </section>
  </article>
</template>

<style scoped>
.maps {
  --gap: 24px;
  --sl-unit: min(1px, (100cqw - 2 * var(--gap)) / 3 / 220);
  --pt: calc(34 * var(--sl-unit));
  --pt-gap: calc(8 * var(--sl-unit));
  container-type: inline-size;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 220px));
  justify-content: center;
  column-gap: var(--gap);
  margin-top: 14px;
}
</style>

<script setup lang="ts">
/* Guide index: the finished seasons' report entries and the newest season's
   counter ladder beside the Upgrades and Mechanics entries. The panels are
   grid areas, so the two rows pair up on wide screens and stack in reading
   order below 1100px. */

import GuideCounterLadder from '@/components/guide/GuideCounterLadder.vue'
import GuideMechanicsIndex from '@/components/guide/GuideMechanicsIndex.vue'
import GuidePvpReport from '@/components/guide/GuidePvpReport.vue'
import GuideUpgradesIndex from '@/components/guide/GuideUpgradesIndex.vue'
import { useRouteLocale } from '@/composables/useRouteLocale'
import { PVP_SEASONS } from '@/content/pvp/seasons'
import { useGameDataStore } from '@/stores/gameData'
import { setupGuideContentMeta } from '@/utils/contentMeta'

import '@/styles/content.css'
import '@/styles/guide.css'

const lang = useRouteLocale()
setupGuideContentMeta(lang, 'index')

// SSG-safe: character data loads eagerly, so the portraits bake into the
// static HTML.
useGameDataStore().initializeContentData()

const latest = PVP_SEASONS[0]
</script>

<template>
  <main class="guide-index">
    <GuidePvpReport v-if="latest" class="report" :seasons="PVP_SEASONS" :lang />
    <GuideUpgradesIndex class="upgrades" :lang />
    <GuideCounterLadder v-if="latest" class="ladder" :summary="latest" :lang />
    <GuideMechanicsIndex class="mechanics" :lang />
  </main>
</template>

<style scoped>
.guide-index {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-template-areas:
    'report'
    'upgrades'
    'ladder'
    'mechanics';
  align-items: start;
  gap: var(--stack-gap);
}
.report {
  grid-area: report;
}
.upgrades {
  grid-area: upgrades;
}
.ladder {
  grid-area: ladder;
}
.mechanics {
  grid-area: mechanics;
}

@media (min-width: 1100px) {
  .guide-index {
    grid-template-columns: minmax(0, 7fr) minmax(0, 5fr);
    grid-template-areas:
      'report upgrades'
      'ladder mechanics';
  }
  /* The top pair shares a row: the shorter panel stretches to it rather
     than floating above a gap. */
  .report,
  .upgrades {
    align-self: stretch;
  }
}
</style>

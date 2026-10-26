<script setup lang="ts">
/* Guide index: a card per season's report, newest first, and the newest
   season's counter ladder beside the Upgrades and Mechanics entries. On wide
   screens the report cards span the rows beside Upgrades and the top of
   Mechanics, so every card keeps its own height and Mechanics follows
   Upgrades however many seasons there are. Below 1100px the cards stack in
   reading order. */

import { computed } from 'vue'

import GuideCounterLadder from '@/components/guide/GuideCounterLadder.vue'
import GuideMechanicsIndex from '@/components/guide/GuideMechanicsIndex.vue'
import GuidePvpReport from '@/components/guide/GuidePvpReport.vue'
import GuideUpgradesIndex from '@/components/guide/GuideUpgradesIndex.vue'
import { PVP_SEASONS } from '@/content/pvp/seasons'
import { useGameDataStore } from '@/stores/gameData'
import { useI18nStore } from '@/stores/i18n'
import { setupGuideContentMeta } from '@/utils/contentMeta'

import '@/styles/content.css'
import '@/styles/guide.css'

const i18n = useI18nStore()
const lang = computed(() => i18n.currentLocale)
setupGuideContentMeta(lang, 'index')

// SSG-safe: character data loads eagerly, so the portraits bake into the
// static HTML.
useGameDataStore().initializeContentData()

const latest = PVP_SEASONS[0]
</script>

<template>
  <main class="guide-index">
    <div v-if="latest" class="reports">
      <GuidePvpReport v-for="summary in PVP_SEASONS" :key="summary.season" :summary :lang />
    </div>
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
    'reports'
    'upgrades'
    'ladder'
    'mechanics';
  align-items: start;
  gap: var(--stack-gap);
}
.reports {
  grid-area: reports;
  display: grid;
  gap: var(--stack-gap);
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
      'reports upgrades'
      'reports mechanics'
      'ladder mechanics';
  }
}
</style>

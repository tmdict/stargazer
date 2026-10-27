<script setup lang="ts">
/* Guide index. On wide screens two columns, the reports over Mechanics and
   the generator over Upgrades, so each card follows the one above it however
   tall its neighbour is. On narrow screens the columns dissolve into one
   stack, ordered by the grid's areas. */

import { computed } from 'vue'

import GuideMechanicsIndex from '@/components/guide/GuideMechanicsIndex.vue'
import GuidePvpReport from '@/components/guide/GuidePvpReport.vue'
import GuideUpgradesIndex from '@/components/guide/GuideUpgradesIndex.vue'
import SlGuideEntry from '@/components/guide/sl/SlGuideEntry.vue'
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
</script>

<template>
  <main class="guide-index">
    <div class="column">
      <div class="reports">
        <GuidePvpReport v-for="summary in PVP_SEASONS" :key="summary.season" :summary :lang />
      </div>
      <GuideMechanicsIndex class="mechanics" :lang />
    </div>
    <div class="column">
      <SlGuideEntry class="generator" :lang />
      <GuideUpgradesIndex class="upgrades" :lang />
    </div>
  </main>
</template>

<style scoped>
.guide-index {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-template-areas:
    'reports'
    'generator'
    'upgrades'
    'mechanics';
  align-items: start;
  gap: var(--stack-gap);
}
.column {
  display: contents;
}
.reports {
  grid-area: reports;
  display: grid;
  gap: var(--stack-gap);
}
.generator {
  grid-area: generator;
}
.upgrades {
  grid-area: upgrades;
}
.mechanics {
  grid-area: mechanics;
}

@media (min-width: 1100px) {
  .guide-index {
    grid-template-columns: minmax(0, 7fr) minmax(0, 5fr);
    grid-template-areas: none;
  }
  .column {
    display: flex;
    flex-direction: column;
    gap: var(--stack-gap);
  }
}
</style>

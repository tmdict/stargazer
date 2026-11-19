<script setup lang="ts">
/* Guide index. On wide screens two columns, the reports over Honor Duel and
   Mechanics and the generator and Who Would Win? over Upgrades and Combat
   Basics, so each card follows the one above it however tall its neighbour
   is. On narrow screens the columns dissolve into one stack, ordered by the
   grid's areas. */

import { computed } from 'vue'

import GuideIndexRows, { type GuideIndexRow } from '@/components/guide/GuideIndexRows.vue'
import GuideMechanicsIndex from '@/components/guide/GuideMechanicsIndex.vue'
import GuidePvpReport from '@/components/guide/GuidePvpReport.vue'
import GuideUpgradesIndex from '@/components/guide/GuideUpgradesIndex.vue'
import SlGuideEntry from '@/components/guide/sl/SlGuideEntry.vue'
import WwwGuideEntry from '@/components/guide/www/WwwGuideEntry.vue'
import { PVP_SEASONS } from '@/content/pvp/seasons'
import { guidePath, HD_SHOP_PATH, HD_SHOP_PROBABILITY_PATH } from '@/lib/guide'
import { useGameDataStore } from '@/stores/gameData'
import { useI18nStore } from '@/stores/i18n'
import { setupGuideContentMeta } from '@/utils/contentMeta'

import '@/styles/content.css'
import '@/styles/guide.css'

const i18n = useI18nStore()
const lang = computed(() => i18n.currentLocale)

const DUEL_PAGES: readonly GuideIndexRow[] = [
  { to: HD_SHOP_PATH, title: 'shop-title-short', blurb: 'guide-hd-shop-blurb', beta: true },
  {
    to: HD_SHOP_PROBABILITY_PATH,
    title: 'shop-probability-title-short',
    blurb: 'guide-hd-shop-probability-blurb',
  },
]

const COMBAT_PAGES: readonly GuideIndexRow[] = [
  { to: guidePath('factions'), title: 'faction-bonus', blurb: 'guide-factions-blurb' },
  { to: guidePath('damage'), title: 'damage-types', blurb: 'guide-damage-blurb' },
  { to: guidePath('glossary'), title: 'glossary', blurb: 'guide-glossary-blurb' },
]

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
      <GuideIndexRows
        class="duel"
        :lang
        heading="honor-duel"
        blurb="guide-hd-blurb"
        :pages="DUEL_PAGES"
      />
      <GuideMechanicsIndex class="mechanics" :lang />
    </div>
    <div class="column">
      <SlGuideEntry class="generator" :lang />
      <WwwGuideEntry class="www" :lang />
      <GuideUpgradesIndex class="upgrades" :lang />
      <GuideIndexRows
        class="combat"
        :lang
        heading="combat-basics"
        blurb="guide-combat-blurb"
        :pages="COMBAT_PAGES"
      />
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
    'www'
    'duel'
    'upgrades'
    'combat'
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
.www {
  grid-area: www;
}
.duel {
  grid-area: duel;
}
.upgrades {
  grid-area: upgrades;
}
.combat {
  grid-area: combat;
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

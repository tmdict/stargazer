<script setup lang="ts">
import GuideUpgradeSection from '@/components/guide/GuideUpgradeSection.vue'
import { useRouteLocale } from '@/composables/useRouteLocale'
import { useGameDataStore } from '@/stores/gameData'
import { setupGuideContentMeta } from '@/utils/contentMeta'

import '@/styles/content.css'
import '@/styles/guide.css'

const lang = useRouteLocale()
setupGuideContentMeta(lang, 'upgrades')

// The faction icons resolve through the store.
useGameDataStore().initializeContentData()
</script>

<template>
  <main>
    <article class="container guide-panel">
      <div class="content">
        <GuideUpgradeSection :lang />
      </div>
    </article>
  </main>
</template>

<script setup lang="ts">
import { computed } from 'vue'

import GuideUpgradeSection from '@/components/guide/GuideUpgradeSection.vue'
import { useGameDataStore } from '@/stores/gameData'
import { useI18nStore } from '@/stores/i18n'
import { setupGuideContentMeta } from '@/utils/contentMeta'

import '@/styles/content.css'
import '@/styles/guide.css'

const i18n = useI18nStore()
const lang = computed(() => i18n.currentLocale)
setupGuideContentMeta(lang, 'upgrades')

// The faction icons resolve through the store.
useGameDataStore().initializeContentData()
</script>

<template>
  <main>
    <article class="container page-panel guide-panel">
      <div class="content">
        <GuideUpgradeSection :lang />
      </div>
    </article>
  </main>
</template>

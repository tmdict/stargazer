<script setup lang="ts">
import { provide } from 'vue'

import GuideTagSection from '@/components/guide/GuideTagSection.vue'
import { SkillLangKey } from '@/components/skill/snippetKeys'
import { useRouteLocale } from '@/composables/useRouteLocale'
import { useGameDataStore } from '@/stores/gameData'
import { setupGuideContentMeta } from '@/utils/contentMeta'
import { guideTagGroups } from '@/utils/guideTags'

import '@/styles/content.css'

const lang = useRouteLocale()
provide(SkillLangKey, lang)
setupGuideContentMeta(lang.value)

// SSG-safe: character/skill/prose data load eagerly, so every tag section and
// its (hidden) expansion panels bake into the static HTML.
const gameDataStore = useGameDataStore()
gameDataStore.initializeContentData()

const groups = guideTagGroups()
</script>

<template>
  <main>
    <!-- Single dark column; reuses the skill reader surface (content.css). -->
    <article class="container guide-panel">
      <div class="content">
        <GuideTagSection
          v-for="g in groups"
          :key="g.tag"
          :tag="g.tag"
          :characters="g.characters"
          :lang
        />
      </div>
    </article>
  </main>
</template>

<style scoped>
/* Override content.css's modal background/centering, as SkillReader does. */
.guide-panel {
  background: #262626;
  margin: 0;
}

/* Mobile: drop the card chrome so the column fills the width. */
@media (max-width: 768px) {
  .guide-panel {
    max-width: 100% !important;
    border: none;
    box-shadow: none;
    border-radius: var(--radius-medium);
  }
  .content {
    padding: var(--spacing-lg);
  }
}
@media (max-width: 480px) {
  .guide-panel {
    border-radius: 0;
  }
  .content {
    padding: var(--spacing-md);
  }
}
</style>

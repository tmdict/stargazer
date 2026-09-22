<script setup lang="ts">
import { provide } from 'vue'

import GuideTagSection from '@/components/guide/GuideTagSection.vue'
import { SkillLangKey } from '@/components/skill/snippetKeys'
import { useRouteLocale } from '@/composables/useRouteLocale'
import { useGameDataStore } from '@/stores/gameData'
import { setupGuideContentMeta } from '@/utils/contentMeta'
import { guideTagGroups } from '@/utils/guideTags'

import '@/styles/content.css'
import '@/styles/guide.css'

const lang = useRouteLocale()
provide(SkillLangKey, lang)
setupGuideContentMeta(lang, 'mechanics')

// SSG-safe: character/skill/prose data load eagerly, so every tag section
// bakes into the static HTML; a hero's panel mounts on expand.
useGameDataStore().initializeContentData()

const groups = guideTagGroups()
</script>

<template>
  <main>
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

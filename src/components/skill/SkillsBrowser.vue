<script setup lang="ts">
import { ref, watch } from 'vue'

import SkillReader from '@/components/skill/SkillReader.vue'
import SkillsSelection from '@/components/SkillsSelection.vue'
import BottomSheet from '@/components/ui/BottomSheet.vue'
import { useGameDataStore } from '@/stores/gameData'
import { TABLET_MAX_WIDTH } from '@/utils/breakpoints'

// At/above this width the reader and roster sit side by side; below it the
// roster stacks under the reader. Mirrors the `@media (min-width: 1220px)`
// row switch in this file's styles (and BottomSheet's).
const SPLIT_MIN_WIDTH = 1220

const props = defineProps<{
  // null on the /skills index (empty reader); a hero slug on a skill page.
  slug: string | null
  lang: 'en' | 'zh'
}>()

// initializeContentData (unlike initializeData) runs during SSG too, so the
// character grid and its crawlable skill links pre-render into the static HTML.
const gameDataStore = useGameDataStore()
gameDataStore.initializeContentData()

// Mobile: the roster is a pull-up sheet. It opens on the empty /skills index,
// stays peeked on a hero page (so it doesn't cover the reader), and collapses
// when navigating to a hero. Tapping the empty reader re-reveals it.
const expanded = ref(false)
watch(
  () => props.slug,
  (slug) => {
    expanded.value = false
    // Narrow-desktop stacked layout only: the roster sits below the reader, so
    // selecting a hero leaves the user scrolled past the content — jump back to
    // the top to reveal it. Side-by-side (>= SPLIT_MIN_WIDTH) keeps the reader
    // in view, and the mobile sheet (<= TABLET_MAX_WIDTH) collapses to reveal
    // it, so both skip the scroll.
    if (!slug || typeof window === 'undefined') return
    const isMobileSheet = window.matchMedia(`(max-width: ${TABLET_MAX_WIDTH}px)`).matches
    const isSideBySide = window.matchMedia(`(min-width: ${SPLIT_MIN_WIDTH}px)`).matches
    if (!isMobileSheet && !isSideBySide) window.scrollTo(0, 0)
  },
)

const sheet = ref<InstanceType<typeof BottomSheet> | null>(null)
</script>

<template>
  <main>
    <div class="skills-layout">
      <SkillReader class="skills-reader" :slug :lang @empty-click="sheet?.expand()" />
      <BottomSheet ref="sheet" v-model:expanded="expanded" :initial-expanded="!slug">
        <SkillsSelection :characters="gameDataStore.characters" :lang :current-slug="slug" />
      </BottomSheet>
    </div>
  </main>
</template>

<style scoped>
/* Mirrors HomeView's .sections-container split layout. */
.skills-layout {
  display: flex;
  flex-direction: column;
  gap: var(--stack-gap);
  width: 100%;
}

@media (min-width: 1220px) {
  .skills-layout {
    flex-direction: row;
    align-items: flex-start;
  }
  .skills-layout > .skills-reader {
    flex: 0 0 660px;
    width: 660px;
  }
}

/* Widen the reader on larger monitors; the right column keeps the remainder. */
@media (min-width: 1600px) {
  .skills-layout > .skills-reader {
    flex-basis: 860px;
    width: 860px;
  }
}

@media (min-width: 1920px) {
  .skills-layout > .skills-reader {
    flex-basis: 960px;
    width: 960px;
  }
}

/* Mobile: clear the collapsed sheet peek. The roster sheet chrome lives in
   BottomSheet; SkillsSelection owns its own in-sheet fill/scroll/inset. */
@media (max-width: 768px) {
  main {
    padding-bottom: 64px;
  }
}

@media (max-width: 480px) {
  main {
    padding-bottom: 64px;
  }
}
</style>

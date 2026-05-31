<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import CharacterSelectionPopup from '@/components/CharacterSelectionPopup.vue'
import SkillReader from '@/components/skill/SkillReader.vue'
import SkillsSelection from '@/components/SkillsSelection.vue'
import type { CharacterType } from '@/lib/types/character'
import { useGameDataStore } from '@/stores/gameData'

const props = defineProps<{
  // null on the /skills index (empty reader); a hero slug on a skill page.
  slug: string | null
  lang: 'en' | 'zh'
}>()

// initializeContentData (unlike initializeData) runs during SSG too, so the
// character grid and its crawlable skill links pre-render into the static HTML.
const gameDataStore = useGameDataStore()
gameDataStore.initializeContentData()

const router = useRouter()

// Reuses the grid's character picker (CharacterSelectionPopup): clicking the
// empty reader opens it at the click point; selecting navigates to that hero.
const pickerPosition = ref<{ x: number; y: number } | null>(null)

const openPicker = (event: MouseEvent) => {
  pickerPosition.value = { x: event.clientX - 30, y: event.clientY - 30 }
}

const selectCharacter = (character: CharacterType) => {
  pickerPosition.value = null
  router.push(`/${props.lang}/skill/${character.name}`)
}
</script>

<template>
  <main>
    <div class="skills-layout">
      <SkillReader class="skills-reader" :slug :lang @pick="openPicker" />
      <div class="skills-list">
        <SkillsSelection :characters="gameDataStore.characters" :lang :current-slug="slug" />
      </div>
    </div>
    <Teleport to="body">
      <CharacterSelectionPopup
        v-if="pickerPosition"
        :characters="gameDataStore.characters"
        :position="pickerPosition"
        @select="selectCharacter"
        @close="pickerPosition = null"
      />
    </Teleport>
  </main>
</template>

<style scoped>
/* Mirrors HomeView's .sections-container layout. */
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
  .skills-layout > .skills-list {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    flex-direction: column;
    max-height: 100vh;
    container-type: inline-size;
  }
  .skills-layout > .skills-list > * {
    flex: 1;
    min-height: 0;
  }
}

/* Widen the reader on larger monitors; the right column keeps the remainder. */
@media (min-width: 1600px) {
  .skills-layout > .skills-reader {
    flex-basis: 760px;
    width: 760px;
  }
}

@media (min-width: 1920px) {
  .skills-layout > .skills-reader {
    flex-basis: 860px;
    width: 860px;
  }
}

/* Right column uses .section chrome; left reader panel styles itself. */
.skills-list {
  padding: 2em;
  width: 100%;
  background-color: var(--color-bg-primary);
  border-radius: var(--radius-large);
}

/* Mobile horizontal inset matches HomeView: .section 2em − TabNavigation -1em. */
@media (max-width: 768px) {
  .skills-list {
    padding: var(--spacing-lg);
    border-radius: var(--radius-medium);
  }
}
@media (max-width: 480px) {
  .skills-list {
    padding: var(--spacing-sm) var(--spacing-lg);
    border-radius: 0;
  }
}
</style>

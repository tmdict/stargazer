<script setup lang="ts">
import SkillReader from '@/components/skill/SkillReader.vue'
import SkillsSelection from '@/components/SkillsSelection.vue'
import { useGameDataStore } from '@/stores/gameData'
import { useI18nStore } from '@/stores/i18n'

const gameDataStore = useGameDataStore()
gameDataStore.initializeData()

useI18nStore().initialize()
</script>

<template>
  <main class="skills-page">
    <div class="skills-layout">
      <SkillReader class="skills-reader" />
      <div class="skills-list">
        <SkillsSelection :characters="gameDataStore.characters" />
      </div>
    </div>
  </main>
</template>

<style scoped>
.skills-page {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  padding: var(--spacing-2xl) 2em;
}

@media (max-width: 1280px) {
  .skills-page {
    padding: var(--spacing-lg);
  }
}
@media (max-width: 768px) {
  .skills-page {
    padding: var(--spacing-md);
  }
}
@media (max-width: 480px) {
  .skills-page {
    padding: 0;
  }
}

/* Left/right layout mirrors HomeView's .sections-container so the Skills
   page feels consistent with the grid pages on every breakpoint. */
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

/* Right column gets the cream .section chrome; left column is the dark
   reader panel and styles itself. */
.skills-list {
  padding: 2em;
  width: 100%;
  background-color: var(--color-bg-primary);
  border-radius: var(--radius-large);
}

/* Drop horizontal padding on mobile so the inner grid + search-bar get the
   same edge-to-edge real estate that TabNavigation's `margin: -2em` gives
   CharacterSelection on the home page. */
@media (max-width: 768px) {
  .skills-list {
    padding: var(--spacing-lg) 0;
    border-radius: var(--radius-medium);
  }
}
@media (max-width: 480px) {
  .skills-list {
    padding: var(--spacing-sm) 0;
    border-radius: 0;
  }
}
</style>

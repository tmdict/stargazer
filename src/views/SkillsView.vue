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
  <main>
    <div class="skills-layout">
      <SkillReader class="skills-reader" />
      <div class="skills-list">
        <SkillsSelection :characters="gameDataStore.characters" />
      </div>
    </div>
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

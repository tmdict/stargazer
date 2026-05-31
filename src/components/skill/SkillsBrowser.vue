<script setup lang="ts">
import { watch } from 'vue'

import SkillReader from '@/components/skill/SkillReader.vue'
import SkillsSelection from '@/components/SkillsSelection.vue'
import { useBottomSheet } from '@/composables/useBottomSheet'
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

// Mobile: the roster column becomes a pull-up bottom sheet over the reader. It
// opens on the empty /skills index, but stays peeked on a hero page so it
// doesn't cover the skill content; picking a hero collapses it.
const {
  expanded,
  dragging,
  sheetStyle,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onMouseDown,
  collapse,
} = useBottomSheet({
  peek: 96,
  expanded: 0.62,
  initialExpanded: !props.slug,
})

watch(() => props.slug, collapse)
</script>

<template>
  <main>
    <!-- Tap-scrim: dismisses the expanded sheet when tapping the reader above. -->
    <div v-if="expanded" class="sheet-backdrop" @click="collapse" />
    <div class="skills-layout">
      <SkillReader class="skills-reader" :slug :lang />
      <div class="skills-list" :class="{ 'is-dragging': dragging }" :style="sheetStyle">
        <div
          class="sheet-handle-area"
          @touchstart.passive="onTouchStart"
          @touchmove.passive="onTouchMove"
          @touchend="onTouchEnd"
          @touchcancel="onTouchEnd"
          @mousedown="onMouseDown"
        >
          <span class="sheet-handle" />
        </div>
        <SkillsSelection :characters="gameDataStore.characters" :lang :current-slug="slug" />
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

/* The drag handle only exists in the mobile bottom-sheet mode. */
.sheet-handle-area {
  display: none;
}

/* Scrim behind the expanded sheet (mobile only — only rendered when expanded).
   Sits just under the sheet (z 800); a tap collapses it. */
.sheet-backdrop {
  position: fixed;
  inset: 0;
  z-index: 799;
  background: rgba(0, 0, 0, 0.15);
  animation: sheet-fade-in 0.2s ease;
}
@keyframes sheet-fade-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* Mobile/tablet: the roster becomes a pull-up bottom sheet over the reader.
   Layout is CSS-driven (so SSG markup hydrates without a mismatch); the
   composable adds the drag once mounted, overriding `transform` inline.
   Mirrors HomeView's grid sheet (.tab-section) — keep the two in sync. */
@media (max-width: 768px) {
  main {
    /* Clear the collapsed peek so the reader's last content isn't hidden. */
    padding-bottom: 96px;
  }

  .skills-list {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    height: 62vh;
    padding: 0;
    border-radius: var(--radius-large) var(--radius-large) 0 0;
    box-shadow: 0 -6px 24px rgba(0, 0, 0, 0.25);
    z-index: 800;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    /* Collapsed peek before the composable engages; it sets the same inline. */
    transform: translateY(calc(62vh - 96px));
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  }
  .skills-list.is-dragging {
    transition: none;
  }

  .sheet-handle-area {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    justify-content: center;
    height: 28px;
    touch-action: none;
    cursor: grab;
  }
  .sheet-handle {
    width: 40px;
    height: 4px;
    border-radius: 999px;
    background: rgba(0, 0, 0, 0.22);
  }

  /* Roster fills the sheet and scrolls within it. */
  .skills-list > :deep(.skills-selection) {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 0 var(--spacing-lg) var(--spacing-lg);
  }
}

@media (max-width: 480px) {
  main {
    padding-bottom: 88px;
  }
  .skills-list > :deep(.skills-selection) {
    padding: 0 var(--spacing-md) var(--spacing-md);
  }
}
</style>

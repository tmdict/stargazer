<script setup lang="ts">
import { ref } from 'vue'

import CharacterGrid from '@/components/CharacterGrid.vue'
import CharacterIcon from '@/components/CharacterIcon.vue'
import GuideCharacterPanel from '@/components/guide/GuideCharacterPanel.vue'
import type { CharacterType } from '@/lib/types/character'
import type { AppLocale } from '@/lib/types/i18n'
import { appLabel } from '@/utils/skillLabels'

defineProps<{ tag: string; characters: readonly CharacterType[]; lang: AppLocale }>()

// One open panel per section.
const expanded = ref<string | null>(null)
const toggle = (slug: string) => {
  expanded.value = expanded.value === slug ? null : slug
}
</script>

<template>
  <section class="tag-section">
    <header class="tag-head">
      <h2 class="tag-name">{{ appLabel(tag, lang) }}</h2>
      <span class="tag-count">{{ characters.length }}</span>
    </header>

    <CharacterGrid>
      <CharacterIcon
        v-for="c in characters"
        :key="c.id"
        :character="c"
        :hide-info="true"
        :is-selected="expanded === c.name"
        :selected-filter="tag"
        @character-click="toggle(c.name)"
      />
    </CharacterGrid>

    <!-- Mount only the expanded panel (keyed so switching characters remounts
         cleanly). The per-hero skill pages already pre-render this skill content,
         so the guide needn't bake every collapsed expansion into static HTML. -->
    <GuideCharacterPanel v-if="expanded" :key="expanded" :slug="expanded" :tag :lang />
  </section>
</template>

<style scoped>
.tag-head {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  margin: var(--spacing-xl) 0 0;
  padding-bottom: var(--spacing-sm);
  border-bottom: 2px solid var(--color-border-primary);
}
.tag-section:first-child .tag-head {
  margin-top: 0;
}

/* Match the skill content's section headings (content.css `.content h2`). */
.tag-name {
  margin: 0;
  padding: 0;
  border-bottom: none;
  font-size: 18px;
  font-weight: 600;
  color: #fff;
}
.tag-count {
  font-size: 0.9rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.55);
}

/* Smaller than the roster default; icons here are toggles, not drag handles.
   The wrapper text color (#333) targets light roster surfaces, so re-light the
   energy badge shown under icons in the initial-energy-300 section. */
.tag-section :deep(.character-display) {
  width: 56px;
  height: 56px;
  box-shadow: 0 0 0 4px #fff;
  cursor: pointer;
}
.tag-section :deep(.portrait) {
  width: 64px;
  height: 64px;
}
.tag-section :deep(.character-display.selected) {
  box-shadow: 0 0 0 4px #c05b4d;
}
.tag-section :deep(.character-energy) {
  color: rgba(255, 255, 255, 0.85);
}

@media (max-width: 480px) {
  .tag-section :deep(.character-display) {
    width: 46px;
    height: 46px;
    box-shadow: 0 0 0 3px #fff;
  }
  .tag-section :deep(.portrait) {
    width: 53px;
    height: 53px;
  }
  .tag-section :deep(.character-display.selected) {
    box-shadow: 0 0 0 3px #c05b4d;
  }
}
</style>

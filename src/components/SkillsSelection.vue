<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'

import CharacterFilterStrip from './CharacterFilterStrip.vue'
import CharacterGrid from './CharacterGrid.vue'
import CharacterIcon from './CharacterIcon.vue'
import SkillSearchTrigger from '@/components/search/SkillSearchTrigger.vue'
import { useCharacterFilters } from '@/composables/useCharacterFilters'
import type { CharacterType } from '@/lib/types/character'
import type { SkillLocale } from '@/lib/types/i18n'
import { useI18nStore } from '@/stores/i18n'

const props = defineProps<{
  characters: readonly CharacterType[]
  /** Skill-text language the tiles link into: the route prefix on skill
   * pages (browsing keeps the reading language), the saved pref on the
   * /skills index. Display strings stay in the chrome locale. */
  linkLocale: SkillLocale
  currentSlug?: string | null
}>()

const i18n = useI18nStore()

// Text search lives in the search overlay (SkillSearchOverlay); the panel keeps
// only the icon filters, so the grid is always visible.
// Placeholders have no skill pages, so the skills hero list leaves them out.
const { factionFilter, classFilter, damageFilter, selectedTagNames, filteredCharacters } =
  useCharacterFilters(computed(() => props.characters.filter((c) => !c.placeholder)))

// Seed the tag filter from `/skills?tag=<name>` (e.g. a clicked skill chip).
const route = useRoute()
watch(
  () => route.query.tag,
  (tag) => {
    selectedTagNames.value = typeof tag === 'string' ? tag : null
  },
  { immediate: true },
)
</script>

<template>
  <!-- Hero list text (names, filters, results chrome) is app-locale even on
       exotic skill pages, so it carries its own lang under the content-locale
       <html lang> (fonts + screen readers follow the chrome language). -->
  <div v-scroll-chain class="skills-selection" :lang="i18n.currentLocale">
    <div class="search-row">
      <SkillSearchTrigger />
    </div>

    <CharacterFilterStrip
      v-model:faction-filter="factionFilter"
      v-model:class-filter="classFilter"
      v-model:damage-filter="damageFilter"
      v-model:tag-filter="selectedTagNames"
      :characters
    />

    <CharacterGrid>
      <RouterLink
        v-for="character in filteredCharacters"
        :key="character.id"
        :to="`/${linkLocale}/skill/${character.name}`"
        class="character-cell"
      >
        <CharacterIcon
          :character
          hide-tooltip
          :is-selected="currentSlug === character.name"
          :selected-filter="selectedTagNames"
        />
      </RouterLink>
    </CharacterGrid>
  </div>
</template>

<style scoped>
.skills-selection {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  min-height: var(--panel-min-height);
  /* Contain overscroll so collapsing the sheet doesn't pull/refresh the page. */
  overscroll-behavior: contain;
}

@media (min-width: 1220px) {
  .skills-selection {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }
}

/* Clear the panel's scrollbar on desktop (mobile sets its own inset below). */
.search-row {
  display: flex;
  padding-right: var(--spacing-lg);
}

.character-cell {
  cursor: pointer;
  text-decoration: none;
  color: inherit;
}

@media (max-width: 768px) {
  /* Fill the mobile hero list sheet and scroll within it. No panel inset: the grid
     insets itself (CharacterGrid) and the filter/results go edge-to-edge; the
     search row keeps its own horizontal inset (see .search-row below). */
  .skills-selection {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 0 0 var(--spacing-lg);
  }
  /* The panel goes edge-to-edge in the sheet; inset the trigger row itself. */
  .search-row {
    padding: var(--spacing-sm) var(--spacing-md) 0;
  }
  .search-row :deep(.search-trigger) {
    max-width: none;
  }
}

@media (max-width: 480px) {
  .skills-selection {
    gap: var(--spacing-sm);
    padding: 0 0 var(--spacing-md);
  }
  .search-row {
    padding: var(--spacing-sm) var(--spacing-sm) 0;
  }
}
</style>

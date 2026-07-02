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
import { useGameDataStore } from '@/stores/gameData'
import { useI18nStore } from '@/stores/i18n'

const props = defineProps<{
  characters: readonly CharacterType[]
  /** Skill-text language the tiles link into: the route prefix on skill
   * pages (browsing keeps the reading language), the saved pref on the
   * /skills index. Display strings stay in the chrome locale. */
  linkLocale: SkillLocale
  currentSlug?: string | null
}>()

const gameDataStore = useGameDataStore()
const i18n = useI18nStore()

// Text search lives in the ⌘K overlay (SkillSearchOverlay); the panel keeps
// only the icon filters, so the grid is always visible.
const { factionFilter, classFilter, damageFilter, selectedTagNames, filteredCharacters } =
  useCharacterFilters(computed(() => props.characters))

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
  <!-- Roster text (names, filters, results chrome) is app-locale even on
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

    <!-- Meta row mirrors CharacterInfoIcons; wider gap replaces info button. -->
    <CharacterGrid>
      <RouterLink
        v-for="character in filteredCharacters"
        :key="character.id"
        :to="`/${linkLocale}/skill/${character.name}`"
        class="character-cell"
      >
        <CharacterIcon
          :character
          :hide-info="true"
          :is-selected="currentSlug === character.name"
          :selected-filter="selectedTagNames"
        />
        <div class="meta-row">
          <img
            :src="gameDataStore.getIcon(`faction-${character.faction}`)"
            :alt="character.faction"
            class="meta-icon"
          />
          <img
            :src="gameDataStore.getIcon(`class-${character.class}`)"
            :alt="character.class"
            class="meta-icon"
          />
        </div>
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
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  text-decoration: none;
  color: inherit;
}

/* Flatten so energy badge and meta-row share one flex order. */
.character-cell :deep(.character-wrapper) {
  display: contents;
}
.character-cell :deep(.character-display) {
  order: 1;
}
.character-cell .meta-row {
  order: 2;
}
.character-cell :deep(.character-energy) {
  order: 3;
}

/* Wider gap (0.6 vs 0.2rem) compensates for the missing info button. */
.meta-row {
  display: flex;
  justify-content: center;
  gap: 0.6rem;
  padding-top: 0.4rem;
}

.meta-icon {
  width: 21px;
  height: 21px;
  border: 1px solid #484848;
  border-radius: 50%;
  object-fit: cover;
}

@media (max-width: 768px) {
  /* Fill the mobile roster sheet and scroll within it. No panel inset: the grid
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
  /* Match CharacterInfoIcons mobile sizing. */
  .meta-row {
    gap: 0.25rem;
  }
  .meta-icon {
    width: 18px;
    height: 18px;
  }
}
</style>

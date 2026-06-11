<script setup lang="ts">
import { computed, watch } from 'vue'
import { useRoute } from 'vue-router'

import CharacterFilterStrip from './CharacterFilterStrip.vue'
import CharacterGrid from './CharacterGrid.vue'
import CharacterIcon from './CharacterIcon.vue'
import CharacterSearchBar from './CharacterSearchBar.vue'
import CharacterSearchResults from './CharacterSearchResults.vue'
import { useCharacterRoster } from '@/composables/useCharacterRoster'
import type { CharacterType } from '@/lib/types/character'
import { useGameDataStore } from '@/stores/gameData'
import { useI18nStore } from '@/stores/i18n'

const props = defineProps<{
  characters: readonly CharacterType[]
  lang: 'en' | 'zh'
  currentSlug?: string | null
  /** Route segment the roster links into (`skill` or `guide`). */
  routeBase?: string
}>()

const gameDataStore = useGameDataStore()
const i18n = useI18nStore()

const lang = computed<'en' | 'zh'>(() => props.lang)
const base = computed(() => props.routeBase ?? 'skill')

const {
  factionFilter,
  classFilter,
  damageFilter,
  selectedTagNames,
  filteredCharacters,
  searchQuery,
  visibleSearchResults,
} = useCharacterRoster(
  computed(() => props.characters),
  lang,
)

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
  <div class="skills-selection">
    <CharacterSearchBar
      v-model="searchQuery"
      :placeholder="i18n.t('app.skill-search-placeholder')"
      :count="visibleSearchResults?.length ?? null"
      :count-label="i18n.t('app.skill-results')"
    />

    <CharacterFilterStrip
      v-model:faction-filter="factionFilter"
      v-model:class-filter="classFilter"
      v-model:damage-filter="damageFilter"
      v-model:tag-filter="selectedTagNames"
      :characters
    />

    <!-- Meta row mirrors CharacterInfoIcons; wider gap replaces info button. -->
    <CharacterGrid v-if="!visibleSearchResults">
      <RouterLink
        v-for="character in filteredCharacters"
        :key="character.id"
        :to="`/${lang}/${base}/${character.name}`"
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

    <CharacterSearchResults
      v-else
      :results="visibleSearchResults"
      :lang
      :query="searchQuery"
      mode="link"
      :link-base="base"
      :current-slug="currentSlug"
    />
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
     search row keeps its own horizontal inset (CharacterSearchBar). */
  .skills-selection {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 0 0 var(--spacing-lg);
  }
}

@media (max-width: 480px) {
  .skills-selection {
    gap: var(--spacing-sm);
    padding: 0 0 var(--spacing-md);
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

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import CharacterFilterStrip from './CharacterFilterStrip.vue'
import CharacterGrid from './CharacterGrid.vue'
import CharacterIcon from './CharacterIcon.vue'
import { useCharacterFilters } from '@/composables/useCharacterFilters'
import { useSkillSearch } from '@/composables/useSkillSearch'
import type { CharacterType } from '@/lib/types/character'
import { type SlotKey } from '@/lib/types/skill'
import { useGameDataStore } from '@/stores/gameData'
import { useI18nStore } from '@/stores/i18n'
import { loadAppLocales, loadCharacterLocales } from '@/utils/dataLoader'

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

// 150ms debounce gates the heavier search index lookup.
const searchQuery = ref('')
const debouncedQuery = ref('')
let debounceTimer: ReturnType<typeof setTimeout> | null = null

watch(searchQuery, (q) => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debouncedQuery.value = q
  }, 150)
})

// Selecting a tag clears the search (both refs to avoid a debounce flash).
watch(selectedTagNames, () => {
  if (!searchQuery.value) return
  if (debounceTimer) clearTimeout(debounceTimer)
  searchQuery.value = ''
  debouncedQuery.value = ''
})

onUnmounted(() => {
  if (debounceTimer) clearTimeout(debounceTimer)
})

const searchResults = useSkillSearch(debouncedQuery, lang)

// Search ∩ filters; results stay ordered by hit count desc.
const visibleSearchResults = computed(() => {
  const results = searchResults.value
  if (!results) return null
  const allowed = new Set(filteredCharacters.value.map((c) => c.name))
  return results.filter((r) => allowed.has(r.slug))
})

function heroName(slug: string): string {
  return loadCharacterLocales()[slug]?.[lang.value] ?? slug
}

const SLOT_LABEL_KEY: Record<SlotKey, string> = {
  ultimate: 'ultimate',
  skill2: 'skill-2',
  skill3: 'skill-3',
  mastery: 'hero-focus',
  ex: 'ex-skill',
  awakening: 'enhance-force',
}

function slotLabel(slot: SlotKey): string {
  const app = loadAppLocales()
  return app[SLOT_LABEL_KEY[slot]]?.[lang.value] ?? slot
}

// null for name matches — already highlighted in the displayed name.
function locText(loc: 'name' | 'skill-name' | 'description', slot?: SlotKey, level?: number) {
  if (loc === 'name' || !slot) return null
  if (loc === 'skill-name') return slotLabel(slot)
  return level ? `${slotLabel(slot)} · L${level}` : slotLabel(slot)
}
</script>

<template>
  <div class="skills-selection">
    <!-- type="search" for the native webkit clear button. -->
    <div class="search-row">
      <input
        v-model="searchQuery"
        type="search"
        class="search-input"
        :placeholder="i18n.t('app.skill-search-placeholder')"
      />
      <span v-if="visibleSearchResults" class="search-count">
        {{ visibleSearchResults.length }} {{ i18n.t('app.skill-results') }}
      </span>
    </div>

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
          :hideInfo="true"
          :isSelected="currentSlug === character.name"
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

    <div v-else class="results">
      <p v-if="visibleSearchResults.length === 0" class="empty-results">
        {{ i18n.t('app.skill-no-matches', { query: `"${debouncedQuery}"` }) }}
      </p>
      <RouterLink
        v-for="result in visibleSearchResults"
        :key="result.slug"
        :to="`/${lang}/${base}/${result.slug}`"
        class="result-row"
        :class="{
          active: currentSlug === result.slug,
          'single-hit': result.hits.length === 1,
        }"
      >
        <img
          :src="gameDataStore.getCharacterImage(result.slug)"
          :alt="heroName(result.slug)"
          class="result-portrait"
        />
        <div class="result-body">
          <div v-for="(hit, i) in result.hits" :key="i" class="snippet">
            <span v-if="locText(hit.loc, hit.slot, hit.level)" class="loc">{{
              locText(hit.loc, hit.slot, hit.level)
            }}</span>
            <span class="snippet-text"
              >{{ hit.snippet.pre }}<mark>{{ hit.snippet.match }}</mark
              >{{ hit.snippet.post }}</span
            >
          </div>
        </div>
      </RouterLink>
    </div>
  </div>
</template>

<style scoped>
.skills-selection {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  min-height: var(--panel-min-height);
  /* Keep roster overscroll local — collapsing the sheet by dragging its content
     must not pull or pull-to-refresh the page behind it. */
  overscroll-behavior: contain;
}

@media (min-width: 1220px) {
  .skills-selection {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }
}

.search-row {
  display: flex;
  gap: var(--spacing-md);
  flex-wrap: wrap;
  align-items: center;
}

.search-input {
  flex: 1;
  min-width: 240px;
  max-width: 460px;
  padding: 0.5rem 0.85rem;
  font: inherit;
  font-size: 0.95rem;
  color: var(--color-text-primary);
  background: var(--color-bg-white);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-medium);
  transition: border-color var(--transition-fast);
}

.search-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.search-input::placeholder {
  color: var(--color-text-secondary);
  opacity: 0.65;
}

/* WebKit-only: Firefox has no styleable pseudo for the clear glyph. */
.search-input::-webkit-search-cancel-button {
  -webkit-appearance: none;
  appearance: none;
  height: 14px;
  width: 14px;
  margin-left: 4px;
  background: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12' fill='none' stroke='%23666' stroke-width='1.4' stroke-linecap='round'><path d='M2 2 L10 10 M10 2 L2 10'/></svg>")
    no-repeat center / 12px 12px;
  cursor: pointer;
  opacity: 0.55;
  transition: opacity 120ms ease;
}

.search-input::-webkit-search-cancel-button:hover {
  opacity: 1;
}

.search-count {
  color: var(--color-text-secondary);
  font-size: 0.85rem;
  white-space: nowrap;
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
     insets itself (CharacterGrid) and the filter/results go edge-to-edge; only
     the search row keeps a horizontal inset so the input isn't flush. */
  .skills-selection {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 0 0 var(--spacing-lg);
  }
  .search-row {
    padding: var(--spacing-sm) var(--spacing-md) 0;
  }
  .search-input {
    min-width: 0;
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

.results {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: var(--spacing-sm) var(--spacing-lg) var(--spacing-sm) 0;
}

/* Cards carry their own padding; wrapper goes edge-to-edge on mobile. */
@media (max-width: 768px) {
  .results {
    padding: 0;
  }
}

.empty-results {
  text-align: center;
  color: var(--color-text-secondary);
  font-style: italic;
  padding: var(--spacing-xl);
}

/* Mirrors WandWarsRecommendation's .recommendation-card. */
.result-row {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm);
  background: var(--color-bg-white);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-medium);
  cursor: pointer;
  text-decoration: none;
  color: inherit;
  transition: box-shadow var(--transition-fast);
}
/* Single snippet looks lopsided top-aligned against the portrait. */
.result-row.single-hit {
  align-items: center;
}
.result-row:hover {
  box-shadow: var(--shadow-small);
}
.result-row.active {
  border-color: var(--color-primary);
}
/* Full-width on mobile → square corners. Keep after the base .result-row rules
   so it wins on source order (equal specificity). */
@media (max-width: 768px) {
  .result-row {
    border-radius: 0;
  }
}

.result-portrait {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-round);
  object-fit: cover;
  object-position: center 20%;
  flex-shrink: 0;
}

.result-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.snippet {
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  line-height: 1.45;
}

.snippet .loc {
  display: inline-block;
  background: rgba(54, 149, 142, 0.12);
  color: var(--color-primary);
  font-size: 0.65rem;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 3px;
  margin-right: 6px;
  letter-spacing: 0.02em;
  vertical-align: middle;
}

.snippet-text mark {
  background: rgba(247, 216, 124, 0.55);
  color: #5a4410;
  padding: 0 2px;
  border-radius: 2px;
}
</style>

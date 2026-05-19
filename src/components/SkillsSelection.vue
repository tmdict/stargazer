<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'

import CharacterFilterStrip from './CharacterFilterStrip.vue'
import CharacterIcon from './CharacterIcon.vue'
import { useCharacterFilters } from '@/composables/useCharacterFilters'
import { useSkillSearch } from '@/composables/useSkillSearch'
import type { CharacterType } from '@/lib/types/character'
import { type SlotKey } from '@/lib/types/skill'
import { useGameDataStore } from '@/stores/gameData'
import { useI18nStore } from '@/stores/i18n'
import { useSkillsStore } from '@/stores/skills'
import { loadAppLocales, loadCharacterLocales } from '@/utils/dataLoader'

const props = defineProps<{
  characters: readonly CharacterType[]
}>()

const gameDataStore = useGameDataStore()
const skillsStore = useSkillsStore()
const i18n = useI18nStore()

const lang = computed<'en' | 'zh'>(() => (i18n.currentLocale === 'zh' ? 'zh' : 'en'))

const { factionFilter, classFilter, damageFilter, selectedTagNames, filteredCharacters } =
  useCharacterFilters(computed(() => props.characters))

// Two refs so the input stays responsive while a 150ms debounce gates the
// (heavier) search index lookup.
const searchQuery = ref('')
const debouncedQuery = ref('')
let debounceTimer: ReturnType<typeof setTimeout> | null = null

watch(searchQuery, (q) => {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    debouncedQuery.value = q
  }, 150)
})

onUnmounted(() => {
  if (debounceTimer) clearTimeout(debounceTimer)
})

const searchResults = useSkillSearch(debouncedQuery, lang)

// Search ∩ filters. Search results are already ordered by hit count desc.
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

// `null` for name matches — they're already highlighted in the displayed name.
function locText(loc: 'name' | 'skill-name' | 'description', slot?: SlotKey, level?: number) {
  if (loc === 'name' || !slot) return null
  if (loc === 'skill-name') return slotLabel(slot)
  return level ? `${slotLabel(slot)} · L${level}` : slotLabel(slot)
}

const handleSelect = (character: CharacterType) => {
  skillsStore.setSelectedSlug(character.name)
}

const handleSelectSlug = (slug: string) => {
  skillsStore.setSelectedSlug(slug)
}
</script>

<template>
  <div class="skills-selection">
    <!-- Native <input type="search"> for the built-in webkit clear button. -->
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

    <!-- Meta row mirrors CharacterInfoIcons' dimensions so cards match the
         Characters tab; info button is replaced by a wider gap. -->
    <div v-if="!visibleSearchResults" class="characters">
      <div
        v-for="character in filteredCharacters"
        :key="character.id"
        class="character-cell"
        @click="handleSelect(character)"
      >
        <CharacterIcon
          :character
          :hideInfo="true"
          :isSelected="skillsStore.selectedSlug === character.name"
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
      </div>
    </div>

    <div v-else class="results">
      <p v-if="visibleSearchResults.length === 0" class="empty-results">
        {{ i18n.t('app.skill-no-matches', { query: `"${debouncedQuery}"` }) }}
      </p>
      <div
        v-for="result in visibleSearchResults"
        :key="result.slug"
        class="result-row"
        :class="{
          active: skillsStore.selectedSlug === result.slug,
          'single-hit': result.hits.length === 1,
        }"
        @click="handleSelectSlug(result.slug)"
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
      </div>
    </div>
  </div>
</template>

<style scoped>
.skills-selection {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-lg);
  min-height: 656px;
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

/* Style WebKit's native clear glyph. Firefox has no styleable pseudo here. */
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

/* Spacing mirrors CharacterSelection.vue. */
.characters {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-lg);
  justify-content: flex-start;
  align-content: flex-start;
  padding: var(--spacing-lg);
  border-radius: var(--radius-large);
}

.character-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
}

/* Wider gap (0.6 vs 0.2rem) compensates for the missing info button between
   the two icons on the Characters tab. */
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
  .characters {
    padding: var(--spacing-md);
    justify-content: center;
  }
}

@media (max-width: 480px) {
  .skills-selection {
    gap: var(--spacing-sm);
  }
  .characters {
    gap: var(--spacing-sm);
    padding: var(--spacing-sm);
    justify-content: center;
  }
}

.results {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: var(--spacing-sm) var(--spacing-lg) var(--spacing-sm) 0;
}

.empty-results {
  text-align: center;
  color: var(--color-text-secondary);
  font-style: italic;
  padding: var(--spacing-xl);
}

/* Card shape mirrors WandWarsRecommendation's .recommendation-card. */
.result-row {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm);
  background: var(--color-bg-white);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-medium);
  cursor: pointer;
  transition: box-shadow var(--transition-fast);
}
/* Single snippet looks lopsided when top-aligned against the portrait. */
.result-row.single-hit {
  align-items: center;
}
.result-row:hover {
  box-shadow: var(--shadow-small);
}
.result-row.active {
  border-color: var(--color-primary);
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

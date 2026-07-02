<script setup lang="ts">
import { RouterLink } from 'vue-router'

import type { SearchHit, SearchResult } from '@/composables/useSkillSearch'
import type { SlotKey } from '@/lib/types/skill'
import { useGameDataStore } from '@/stores/gameData'
import { useI18nStore } from '@/stores/i18n'
import { loadAppLocales, loadCharacterLocales } from '@/utils/dataLoader'

defineProps<{
  results: SearchResult[]
  /** Current query, for the no-matches message. */
  query: string
  /** `link` wraps each card in a RouterLink; `action` makes it a button. */
  mode: 'link' | 'action'
  /** Link mode: slug of the open page, highlighted as active. */
  currentSlug?: string | null
}>()

const emit = defineEmits<{ select: [slug: string] }>()

const gameDataStore = useGameDataStore()
const i18n = useI18nStore()

// Display strings render in the chrome locale; link prefixes come from each
// result's matched locale instead, so the snippet clicked is the content
// landed on.
function heroName(slug: string): string {
  return loadCharacterLocales()[slug]?.[i18n.currentLocale] ?? slug
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
  return app[SLOT_LABEL_KEY[slot]]?.[i18n.currentLocale] ?? slot
}

// null for name matches: already highlighted in the displayed name. Labels
// mirror the skills page: "LV n" for skill levels, "REFINE n" for EX tiers.
function locText(hit: SearchHit): string | null {
  const { loc, slot } = hit
  if (loc === 'name' || !slot) return null
  if (loc === 'skill-name') return slotLabel(slot)
  if (hit.tier != null) return `${slotLabel(slot)} · REFINE ${hit.tier}`
  return hit.level ? `${slotLabel(slot)} · LV ${hit.level}` : slotLabel(slot)
}
</script>

<template>
  <div class="results">
    <p v-if="results.length === 0" class="empty-results">
      {{ i18n.t('app.skill-no-matches', { query: `"${query}"` }) }}
    </p>
    <!-- Anchor in link mode (crawlable permalinks); button in action mode. The
         card body uses spans so it's valid phrasing content inside both. -->
    <component
      :is="mode === 'link' ? RouterLink : 'button'"
      v-for="result in results"
      :key="result.slug"
      :to="mode === 'link' ? `/${result.locale}/skill/${result.slug}` : undefined"
      :type="mode === 'action' ? 'button' : undefined"
      class="result-row"
      :class="{
        active: mode === 'link' && currentSlug === result.slug,
        'single-hit': result.hits.length === 1,
      }"
      @click="mode === 'action' && emit('select', result.slug)"
    >
      <img
        :src="gameDataStore.getCharacterImage(result.slug)"
        :alt="heroName(result.slug)"
        class="result-portrait"
      />
      <span class="result-body">
        <span v-for="(hit, i) in result.hits" :key="i" class="snippet">
          <span v-if="locText(hit)" class="loc">{{ locText(hit) }}</span>
          <span class="snippet-text"
            >{{ hit.snippet.pre }}<mark>{{ hit.snippet.match }}</mark
            >{{ hit.snippet.post }}</span
          >
        </span>
      </span>
    </component>
  </div>
</template>

<style scoped>
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

/* Mirrors WandWarsRecommendation's .recommendation-card. The font/text-align/
   width/appearance resets let the action-mode <button> match the link <a>. */
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
  font: inherit;
  text-align: left;
  width: 100%;
  box-sizing: border-box;
  appearance: none;
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
  display: block;
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

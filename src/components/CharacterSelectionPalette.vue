<script setup lang="ts">
/* The search-and-pick palette shared by the on-grid character popup and the
   match import's review picker: name search over every warm locale, a faction
   filter, the icon grid, and Enter to take a search's single match. Board-free;
   the consumer decides what a pick means. */

import { computed, onMounted, ref } from 'vue'

import CharacterIcon from './CharacterIcon.vue'
import FilterIcons from './ui/FilterIcons.vue'
import { matchCharacterNames } from '@/composables/useSkillSearch'
import type { CharacterType } from '@/lib/types/character'
import { useI18nStore } from '@/stores/i18n'

const { characters, pinned = [] } = defineProps<{
  // The pickable pool, in display order.
  characters: readonly CharacterType[]
  // Listed in their own row above the pool while no filter is active.
  pinned?: readonly CharacterType[]
  // What Enter does once the search has narrowed to one hero.
  enterHint: string
}>()

const emit = defineEmits<{
  pick: [character: CharacterType]
}>()

const i18n = useI18nStore()

const factionFilter = ref('')
const factionOptions = computed(() => [...new Set(characters.map((c) => c.faction))].sort())
const factionFiltered = computed(() =>
  factionFilter.value ? characters.filter((c) => c.faction === factionFilter.value) : characters,
)

// Name search composes on top of the faction filter, matching any locale's
// display name like the main roster search does.
const searchQuery = ref('')
const filteredCharacters = computed(() => {
  const q = searchQuery.value.trim()
  if (!q) return factionFiltered.value
  const matches = matchCharacterNames(q)
  return factionFiltered.value.filter((c) => matches.has(c.name))
})

// A search or faction filter is a deliberate narrowing, so it lists only its
// matches; the pinned row exists only in the unfiltered view.
const pinnedRow = computed(() => (searchQuery.value.trim() || factionFilter.value ? [] : pinned))
const listed = computed(() =>
  pinnedRow.value.length
    ? filteredCharacters.value.filter((c) => !pinnedRow.value.includes(c))
    : filteredCharacters.value,
)

// Type-to-pick: focus starts in the search box even on touch. The on-grid
// popup exists only on tablet-and-wider layouts (phones place via the roster
// sheet) and iPad taps land here expecting to type; the import review opens
// it on phones too, where the keyboard is the way to find a hero among the
// pinned candidates. Focusing in the mount tick matters: iPadOS raises the
// keyboard only while the opening tap's user activation is live.
const searchInput = ref<HTMLInputElement>()
onMounted(() => searchInput.value?.focus({ preventScroll: true }))

// Keep in sync with handleEnter's guard: a hint for a dead shortcut misleads.
const enterTarget = computed(() =>
  searchQuery.value.trim() !== '' && filteredCharacters.value.length === 1
    ? filteredCharacters.value[0]!
    : null,
)

// Enter completes a search that narrowed to exactly one hero; clearing the
// query restarts type-to-pick for the next pick (the palette may stay open).
// The Enter that commits an IME composition must not double as a pick.
function handleEnter(event: KeyboardEvent) {
  if (event.isComposing || !enterTarget.value) return
  emit('pick', enterTarget.value)
  searchQuery.value = ''
}
</script>

<template>
  <!-- type="search" for the native clear button. -->
  <input
    ref="searchInput"
    v-model="searchQuery"
    type="search"
    class="search-input"
    :placeholder="i18n.t('app.search-heroes-placeholder')"
    @keydown.enter="handleEnter"
  />
  <div class="filter-row">
    <FilterIcons
      v-model="factionFilter"
      icon-prefix="faction"
      :options="factionOptions"
      :size="28"
      :show-tooltip="false"
    />
  </div>
  <div v-if="pinnedRow.length" class="characters-grid pinned-row">
    <div
      v-for="character in pinnedRow"
      :key="character.id"
      class="character-item"
      @click="emit('pick', character)"
    >
      <CharacterIcon :character :is-draggable="false" :show-simple-tooltip="true" />
    </div>
  </div>
  <div class="characters-grid">
    <div
      v-for="character in listed"
      :key="character.id"
      class="character-item"
      :class="{ 'enter-target': enterTarget === character }"
      @click="emit('pick', character)"
    >
      <CharacterIcon :character :is-draggable="false" :show-simple-tooltip="true" />
    </div>
    <div v-if="listed.length === 0 && pinnedRow.length === 0" class="no-characters">
      {{ i18n.t('app.no-available-heroes') }}
    </div>
  </div>
  <div v-if="enterTarget" class="enter-hint"><kbd>↵</kbd> {{ enterHint }}</div>
</template>

<style scoped>
.search-input {
  /* 4px side margin lines the box up with the character grid's content padding. */
  width: calc(100% - 8px);
  box-sizing: border-box;
  margin: 0 4px 8px;
  padding: 4px 8px;
  font: inherit;
  font-size: 12px;
  color: #fff;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  transition: border-color 0.15s ease;
}

/* 16px floor: iOS zooms the page when a smaller field gains focus, and the
   zoom outlives the field. */
@media (pointer: coarse) {
  .search-input {
    font-size: 1rem;
  }
}

.search-input::placeholder {
  color: rgba(255, 255, 255, 0.45);
}

.search-input:focus {
  outline: none;
  border-color: rgba(255, 255, 255, 0.4);
}

.search-input::-webkit-search-cancel-button {
  -webkit-appearance: none;
  appearance: none;
  height: 12px;
  width: 12px;
  background: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12' fill='none' stroke='%23ccc' stroke-width='1.4' stroke-linecap='round'><path d='M2 2 L10 10 M10 2 L2 10'/></svg>")
    no-repeat center / 12px 12px;
  cursor: pointer;
  opacity: 0.6;
}

.search-input::-webkit-search-cancel-button:hover {
  opacity: 1;
}

.filter-row {
  margin-bottom: 8px;
}

/* FilterIcons defaults to --color-text-secondary (dark gray), which disappears
   on this popup's dark backdrop. Override the "All" button color for legibility. */
.filter-row :deep(.clear-option) {
  color: rgba(255, 255, 255, 0.75);
}

.characters-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 5px;
  /* overflow-y:auto forces overflow-x to auto; pin it hidden so the hover
     scale-up can't add a horizontal scrollbar. Padding gives edge icons room. */
  overflow-x: hidden;
  overflow-y: auto;
  max-height: 280px;
  /* Shrinks first when the popup's cap is reached (SelectionPopup is a column). */
  min-height: 0;
  padding: 2px 4px;
}

.pinned-row {
  flex-shrink: 0;
  max-height: none;
  overflow: visible;
  padding-bottom: 8px;
  margin-bottom: 6px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.character-item {
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 2px;
  border-radius: 4px;
  transition: all 0.15s ease;
}

.character-item:hover {
  transform: scale(1.1);
  filter: brightness(1.2);
}

.character-item :deep(.character-display) {
  width: 45px !important;
  height: 45px !important;
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.2) !important;
}

.character-item :deep(.portrait) {
  width: 50px !important;
  height: 50px !important;
}

.character-item :deep(.character-info) {
  display: none !important;
}

.no-characters {
  grid-column: 1 / -1;
  text-align: center;
  color: rgba(255, 255, 255, 0.6);
  padding: 20px;
  font-size: 14px;
}

/* !important to outrank the base .character-display override above. */
.character-item.enter-target :deep(.character-display) {
  box-shadow: 0 0 0 2px var(--color-primary) !important;
}

.enter-hint {
  display: flex;
  align-items: center;
  gap: 5px;
  margin: 8px 4px 0;
  padding-top: 6px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  font-size: 11px;
  color: rgba(255, 255, 255, 0.55);
  animation: enter-hint-in 0.15s ease;
}

/* system-ui rather than the content font, which lacks the ↵ glyph. */
.enter-hint kbd {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  line-height: 1;
  font-family: system-ui, sans-serif;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.7);
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 4px;
}

@keyframes enter-hint-in {
  from {
    opacity: 0;
  }
}
</style>

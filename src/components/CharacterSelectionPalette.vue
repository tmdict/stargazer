<script setup lang="ts">
/* The search-and-pick palette shared by the on-grid character popup and the
   match import's review picker: name search over every warm locale, a faction
   filter, the icon grid, and Enter to take a search's single match. Board-free;
   the consumer decides what a pick means. A locked hero is never picked. */

import { computed, ref } from 'vue'

import CharacterIcon from './CharacterIcon.vue'
import FilterIcons from './ui/FilterIcons.vue'
import PaletteSearch from './ui/PaletteSearch.vue'
import { matchCharacterNames } from '@/composables/useSkillSearch'
import type { CharacterType, LockedHeroes } from '@/lib/types/character'
import { useI18nStore } from '@/stores/i18n'

const {
  characters,
  pinned = [],
  locked,
} = defineProps<{
  // The pickable pool, in display order.
  characters: readonly CharacterType[]
  // Listed in their own row above the pool while no filter is active.
  pinned?: readonly CharacterType[]
  // What Enter does once the search has narrowed to one hero.
  enterHint: string
  locked?: LockedHeroes
}>()

const emit = defineEmits<{
  pick: [character: CharacterType]
}>()

defineSlots<{
  badge?: (props: { character: CharacterType }) => unknown
}>()

const i18n = useI18nStore()

const lockedNote = (character: CharacterType): string | undefined =>
  locked?.ids.has(character.id) ? locked.note : undefined
const pick = (character: CharacterType): void => {
  if (!lockedNote(character)) emit('pick', character)
}

const factionFilter = ref('')
const factionOptions = computed(() => [...new Set(characters.map((c) => c.faction))].sort())
const factionFiltered = computed(() =>
  factionFilter.value ? characters.filter((c) => c.faction === factionFilter.value) : characters,
)

// Name search composes on top of the faction filter, matching any locale's
// display name like the main picker search does.
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

// Keep in sync with handleEnter's guard: a hint for a dead shortcut misleads.
const enterTarget = computed(() =>
  searchQuery.value.trim() !== '' &&
  filteredCharacters.value.length === 1 &&
  !lockedNote(filteredCharacters.value[0]!)
    ? filteredCharacters.value[0]!
    : null,
)

// Enter completes a search that narrowed to exactly one hero; clearing the
// query restarts type-to-pick for the next pick (the palette may stay open).
function handleEnter() {
  if (!enterTarget.value) return
  emit('pick', enterTarget.value)
  searchQuery.value = ''
}
</script>

<template>
  <PaletteSearch
    v-model="searchQuery"
    :placeholder="i18n.t('app.search-heroes-placeholder')"
    @enter="handleEnter"
  />
  <div class="filter-row">
    <FilterIcons
      v-model="factionFilter"
      icon-prefix="faction"
      :options="factionOptions"
      :size="28"
    />
  </div>
  <div v-if="pinnedRow.length" class="characters-grid pinned-row">
    <div
      v-for="character in pinnedRow"
      :key="character.id"
      class="character-item"
      @click="pick(character)"
    >
      <CharacterIcon
        :character
        :is-draggable="false"
        :show-simple-tooltip="true"
        :locked-note="lockedNote(character)"
      >
        <template v-if="$slots.badge" #badge>
          <slot name="badge" :character />
        </template>
      </CharacterIcon>
    </div>
  </div>
  <div class="characters-grid">
    <div
      v-for="character in listed"
      :key="character.id"
      class="character-item"
      :class="{ 'enter-target': enterTarget === character }"
      @click="pick(character)"
    >
      <CharacterIcon
        :character
        :is-draggable="false"
        :show-simple-tooltip="true"
        :locked-note="lockedNote(character)"
      >
        <template v-if="$slots.badge" #badge>
          <slot name="badge" :character />
        </template>
      </CharacterIcon>
    </div>
    <div v-if="listed.length === 0 && pinnedRow.length === 0" class="no-characters">
      {{ i18n.t('app.no-available-heroes') }}
    </div>
  </div>
  <div v-if="enterTarget" class="enter-hint"><kbd>↵</kbd> {{ enterHint }}</div>
</template>

<style scoped>
.filter-row {
  margin-bottom: 8px;
}

.filter-row :deep(.icon-filter) {
  align-items: flex-start;
}

.filter-row :deep(.icon-options) {
  justify-content: flex-start;
}

.filter-row :deep(.clear-option) {
  color: rgba(255, 255, 255, 0.75);
}

.characters-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 5px;
  /* overflow-y:auto forces overflow-x to auto; pin it hidden so the hover
     scale-up can't add a horizontal scrollbar. */
  overflow-x: hidden;
  overflow-y: auto;
  max-height: 280px;
  min-height: 0;
  padding: 2px var(--palette-inset);
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
  align-items: flex-start;
  justify-content: center;
  cursor: pointer;
  padding: 2px;
  border-radius: 4px;
  transition: all 0.15s ease;
}

.character-item:hover {
  filter: brightness(1.2);
}

.character-item :deep(.character-display) {
  width: var(--palette-icon-size) !important;
  height: var(--palette-icon-size) !important;
  box-shadow: var(--palette-icon-ring) !important;
}

.character-item :deep(.portrait) {
  width: 50px !important;
  height: 50px !important;
}

.character-item :deep(.portrait-badge) {
  margin-top: 0;
}

.no-characters {
  grid-column: 1 / -1;
  text-align: center;
  color: rgba(255, 255, 255, 0.6);
  padding: 20px;
  font-size: 14px;
}

.character-item.enter-target :deep(.character-display) {
  box-shadow: 0 0 0 2px var(--color-primary) !important;
}

.enter-hint {
  display: flex;
  align-items: center;
  gap: 5px;
  margin: 8px var(--palette-inset) 0;
  padding-top: 6px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  font-size: 11px;
  color: rgba(255, 255, 255, 0.55);
  animation: enter-hint-in 0.15s ease;
}

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

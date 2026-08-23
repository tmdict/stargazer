<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import CharacterIcon from './CharacterIcon.vue'
import FilterIcons from './ui/FilterIcons.vue'
import SelectionPopup from './ui/SelectionPopup.vue'
import { useGridContext } from '@/composables/useGridContext'
import { matchCharacterNames } from '@/composables/useSkillSearch'
import { useTouchDetection } from '@/composables/useTouchDetection'
import { teamHasOpenSlot } from '@/lib/characters/character'
import { compareFaction } from '@/lib/filterOrder'
import type { Hex } from '@/lib/hex'
import type { CharacterType } from '@/lib/types/character'
import { useGrids } from '@/stores/grids'
import { useI18nStore } from '@/stores/i18n'
import { getTeamFromTileState } from '@/utils/tileStateFormatting'

interface Props {
  // The tapped tile: determines the team and where the chosen hero is placed.
  hex: Hex
  characters: readonly CharacterType[]
  position: { x: number; y: number }
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
}>()

// The board that opened the popup (injected through GridManager, which
// declares this component, so Teleport doesn't break it). Picks must resolve
// against this board, not the page-wide active board, which any interaction
// on another board can move while the popup is open.
const ctx = useGridContext()
const grids = useGrids()
const i18n = useI18nStore()

const team = computed(() => getTeamFromTileState(ctx.grid.getTileById(props.hex.getId()).state))

// Heroes with a legal placement on this team. While Syn is on, an
// already-placed hero stays listed as its synergy copy, matching the roster's
// lifted grey-out.
const availableCharacters = computed(() => {
  const t = team.value
  if (!t) return []
  return props.characters.filter((char) => grids.resolvePick(ctx, char.id, t) !== null)
})

// Match the main roster's order (CharacterSelection): canonical faction order,
// placeholders trailing as one block in the faction filter icons' order.
const sortedCharacters = computed(() =>
  [...availableCharacters.value].sort(
    (a, b) =>
      (a.placeholder ? 1 : 0) - (b.placeholder ? 1 : 0) ||
      compareFaction(a.faction, b.faction) ||
      a.id - b.id,
  ),
)

// Faction filter composes on top of the available pool.
const factionFilter = ref('')
const factionOptions = computed(() =>
  [...new Set(sortedCharacters.value.map((c) => c.faction))].sort(),
)
const factionFiltered = computed(() =>
  factionFilter.value
    ? sortedCharacters.value.filter((c) => c.faction === factionFilter.value)
    : sortedCharacters.value,
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

// Type-to-pick: focus starts in the search box. Not on touch, where the
// software keyboard would cover the icons most taps are headed for.
const searchInput = ref<HTMLInputElement>()
const { isTouchDevice } = useTouchDetection()
onMounted(() => {
  if (!isTouchDevice.value) searchInput.value?.focus({ preventScroll: true })
})

// Keep in sync with handleEnter's guard: a hint for a dead shortcut misleads.
// Touch flows tap icons directly, so no hint there.
const enterHintVisible = computed(
  () =>
    !isTouchDevice.value &&
    searchQuery.value.trim() !== '' &&
    filteredCharacters.value.length === 1,
)

// Enter completes a search that narrowed to exactly one hero; clearing the
// query restarts type-to-pick for the next placement (the palette stays open).
// The Enter that commits an IME composition must not double as a pick.
function handleEnter(event: KeyboardEvent) {
  if (event.isComposing) return
  if (!searchQuery.value.trim() || filteredCharacters.value.length !== 1) return
  if (handleSelect(filteredCharacters.value[0]!)) searchQuery.value = ''
}

/* Multi-add palette: the first pick fills the tapped tile, later picks
 * auto-place onto a free tile of the same team, and the popup stays open
 * (dismissal is mouse-leave, Esc, or an outside tap) so several heroes can be
 * placed in a row. Placed heroes drop out of the list, and a full team closes
 * the popup since every further pick would be a silent no-op. */
function handleSelect(character: CharacterType): boolean {
  const t = team.value
  if (!t) return false
  const resolved = grids.resolvePick(ctx, character.id, t)
  if (resolved === null) return false
  const anchorFree = ctx.grid.getTileById(props.hex.getId()).characterId === undefined
  const placed = anchorFree ? ctx.place(props.hex.getId(), resolved, t) : ctx.autoPlace(resolved, t)
  if (placed) {
    // Active follows interaction, matching drop routing.
    grids.setActive(ctx.id)
    if (!teamHasOpenSlot(ctx.grid, t, grids.synergy)) emit('close')
  }
  return placed
}
</script>

<template>
  <SelectionPopup :position @close="emit('close')">
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
    <div class="characters-grid">
      <div
        v-for="character in filteredCharacters"
        :key="character.id"
        class="character-item"
        :class="{ 'enter-target': enterHintVisible }"
        @click="handleSelect(character)"
      >
        <CharacterIcon :character :is-draggable="false" :show-simple-tooltip="true" />
      </div>
      <div v-if="filteredCharacters.length === 0" class="no-characters">
        {{ i18n.t('app.no-available-heroes') }}
      </div>
    </div>
    <div v-if="enterHintVisible" class="enter-hint">
      <kbd>↵</kbd> {{ i18n.t('app.place-hero') }}
    </div>
  </SelectionPopup>
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
  padding: 2px 4px;
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

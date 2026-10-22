<script setup lang="ts">
/* The roster import's review: every hero the screenshots give, those to check
   first, then the ones read surely in a compact grid. A hero is one cell, its
   edits applying to every card of it (the same card seen in several
   screenshots); a hero whose cards disagree on its levels, repeat with an
   unsure card, or stand twice in one screenshot shows each card, named by its
   screenshot and slot, to be told apart. A card no hero is taken for comes
   first. The name opens the hero picker with the reader's candidates pinned.
   Every edit is emitted for the import's plan to apply. */

import { computed, ref } from 'vue'

import CharacterSelectionPalette from '@/components/CharacterSelectionPalette.vue'
import ImportCellGrid from '@/components/import/ImportCellGrid.vue'
import ImportHeroCell from '@/components/import/ImportHeroCell.vue'
import SelectionPopup from '@/components/ui/SelectionPopup.vue'
import type { CardRef, RosterImportShot } from '@/composables/useRosterImport'
import { isBaseHeroId } from '@/lib/characters/character'
import { compareFaction } from '@/lib/filterOrder'
import type { CellState } from '@/lib/import/review'
import type { EntryIssue, RosterCard, RosterImportPlan } from '@/lib/rosterImport'
import type { CharacterType } from '@/lib/types/character'
import { useGameDataStore } from '@/stores/gameData'
import { useI18nStore } from '@/stores/i18n'

const { plan, shots } = defineProps<{
  plan: RosterImportPlan
  shots: readonly RosterImportShot[]
}>()

const emit = defineEmits<{
  setHero: [cards: CardRef[], characterId: number | null]
  setLevel: [cards: CardRef[], field: 'paragon' | 'refinement', level: number]
}>()

const gameData = useGameDataStore()
const i18n = useI18nStore()

// One cell of the review: a hero (several cards as one) or one card.
interface CellView {
  key: string
  cards: RosterCard[]
  characterId: number | null
  paragon: number
  refinement: number
  state: CellState
  edited: boolean
  // The screenshot and slot, when the cell is one card of several.
  where: string | null
}

const refs = (cards: readonly RosterCard[]): CardRef[] =>
  cards.map(({ shotId, key }) => ({ shotId, key }))

const cardImage = (card: RosterCard): string =>
  shots.find((s) => s.id === card.shotId)?.cards[card.key] ?? ''

const shotName = (shotId: string): string => shots.find((s) => s.id === shotId)?.name ?? ''

// A hero's cells: one for all its cards, the first one shown, its state the
// first left to check; or, with something to tell apart, one per card.
const cellsOf = (cards: RosterCard[], apart: boolean): CellView[] => {
  if (apart) {
    return cards.map((card) => ({
      key: `${card.shotId}:${card.key}`,
      cards: [card],
      characterId: card.characterId,
      paragon: card.paragon,
      refinement: card.refinement,
      state: card.state,
      edited: card.edited,
      where: `${shotName(card.shotId)} · ${card.key.toUpperCase()}`,
    }))
  }
  const first = cards[0]!
  return [
    {
      key: `${first.shotId}:${first.key}`,
      cards,
      characterId: first.characterId,
      paragon: first.paragon,
      refinement: first.refinement,
      state: cards.find((c) => c.state !== 'sure')?.state ?? 'sure',
      edited: cards.some((c) => c.edited),
      where: null,
    },
  ]
}

const factionOf = (characterId: number): string =>
  gameData.getCharacterById(characterId)?.faction ?? ''

const byHeroOrder = <T extends { characterId: number }>(entries: T[]): T[] =>
  [...entries].sort(
    (a, b) =>
      compareFaction(factionOf(a.characterId), factionOf(b.characterId)) ||
      a.characterId - b.characterId,
  )

// The heroes to check, each with what it asks about and its cells.
const toCheck = computed(() =>
  byHeroOrder(plan.entries.filter((e) => e.check)).map((entry) => ({
    characterId: entry.characterId,
    issues: entry.issues,
    cells: cellsOf(entry.cards, entry.issues.length > 0),
  })),
)
const unnamed = computed(() => plan.unnamed.flatMap((card) => cellsOf([card], true)))
const sure = computed(() =>
  byHeroOrder(plan.entries.filter((e) => !e.check)).flatMap((e) => cellsOf(e.cards, false)),
)

const ISSUE_TEXT: Record<EntryIssue, string> = {
  repeat: 'app.roster-import-repeat',
  levels: 'app.roster-import-levels',
  twice: 'app.roster-import-twice',
}

// ---------- hero picker ----------

// Every real hero in hero list order.
const heroes = computed(() =>
  gameData.characters
    .filter((c) => isBaseHeroId(c.id) && !c.placeholder)
    .sort((a, b) => compareFaction(a.faction, b.faction) || a.id - b.id),
)

const picker = ref<{ cell: CellView; position: { x: number; y: number } } | null>(null)

const togglePicker = (cell: CellView, event: MouseEvent): void => {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  picker.value =
    picker.value?.cell.key === cell.key
      ? null
      : { cell, position: { x: rect.left, y: rect.bottom + 4 } }
}

const pinned = computed(() =>
  (picker.value?.cell.cards[0]?.cell.candidates ?? [])
    .map((c) => gameData.getCharacterById(c.characterId))
    .filter((c): c is CharacterType => c !== undefined),
)

const setPicked = (characterId: number | null): void => {
  if (!picker.value) return
  emit('setHero', refs(picker.value.cell.cards), characterId)
  picker.value = null
}

// The modal stops clicks before they reach the document, where the popup's
// own click-outside listens, so a tap elsewhere in the review closes it.
const closePicker = (event: MouseEvent): void => {
  if ((event.target as HTMLElement).closest('.cell-name')) return
  picker.value = null
}
</script>

<template>
  <div class="roster-review" @click="closePicker">
    <template v-if="toCheck.length || unnamed.length">
      <div class="group-head">{{ i18n.t('app.roster-import-check-first') }}</div>
      <ImportCellGrid v-if="unnamed.length">
        <div v-for="cell in unnamed" :key="cell.key" class="placed">
          <ImportHeroCell
            :card="cardImage(cell.cards[0]!)"
            :character-id="cell.characterId"
            :paragon="cell.paragon"
            :refinement="cell.refinement"
            :state="cell.state"
            :edited="cell.edited"
            :open="picker?.cell.key === cell.key"
            @pick="togglePicker(cell, $event)"
            @hero="emit('setHero', refs(cell.cards), $event)"
            @paragon="emit('setLevel', refs(cell.cards), 'paragon', $event)"
            @refinement="emit('setLevel', refs(cell.cards), 'refinement', $event)"
          />
          <span class="where">{{ cell.where }}</span>
        </div>
      </ImportCellGrid>
      <div v-for="hero in toCheck" :key="hero.characterId" class="hero">
        <ul v-if="hero.issues.length" class="hero-issues">
          <li v-for="issue in hero.issues" :key="issue" :class="{ blocking: issue !== 'repeat' }">
            {{ i18n.t(ISSUE_TEXT[issue]) }}
          </li>
        </ul>
        <ImportCellGrid>
          <div v-for="cell in hero.cells" :key="cell.key" class="placed">
            <ImportHeroCell
              :card="cardImage(cell.cards[0]!)"
              :character-id="cell.characterId"
              :paragon="cell.paragon"
              :refinement="cell.refinement"
              :state="cell.state"
              :edited="cell.edited"
              :open="picker?.cell.key === cell.key"
              @pick="togglePicker(cell, $event)"
              @hero="emit('setHero', refs(cell.cards), $event)"
              @paragon="emit('setLevel', refs(cell.cards), 'paragon', $event)"
              @refinement="emit('setLevel', refs(cell.cards), 'refinement', $event)"
            />
            <span v-if="cell.where" class="where">{{ cell.where }}</span>
          </div>
        </ImportCellGrid>
      </div>
    </template>

    <template v-if="sure.length">
      <div class="group-head">{{ i18n.t('app.roster-import-read-surely') }}</div>
      <ImportCellGrid>
        <ImportHeroCell
          v-for="cell in sure"
          :key="cell.key"
          :card="cardImage(cell.cards[0]!)"
          :character-id="cell.characterId"
          :paragon="cell.paragon"
          :refinement="cell.refinement"
          :state="cell.state"
          :edited="cell.edited"
          :open="picker?.cell.key === cell.key"
          @pick="togglePicker(cell, $event)"
          @hero="emit('setHero', refs(cell.cards), $event)"
          @paragon="emit('setLevel', refs(cell.cards), 'paragon', $event)"
          @refinement="emit('setLevel', refs(cell.cards), 'refinement', $event)"
        />
      </ImportCellGrid>
    </template>

    <!-- Outside the modal's container, so its clicks and Escape are stopped
         here rather than reaching the modal's own close listeners on document. -->
    <Teleport to="body">
      <SelectionPopup
        v-if="picker"
        :position="picker.position"
        over-modal
        @close="picker = null"
        @click.stop
        @keydown.esc.stop="picker = null"
      >
        <CharacterSelectionPalette
          :characters="heroes"
          :pinned
          :enter-hint="i18n.t('app.import-pick-hero')"
          @pick="setPicked($event.id)"
        />
        <button
          v-if="picker.cell.characterId !== null"
          type="button"
          class="picker-remove"
          @click="setPicked(null)"
        >
          {{ i18n.t('app.remove-hero') }}
        </button>
      </SelectionPopup>
    </Teleport>
  </div>
</template>

<style scoped>
.roster-review {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.group-head {
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--import-label);
}

.hero {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.hero-issues {
  margin: 0;
  padding-left: 1.2em;
  font-size: 0.8rem;
  color: var(--import-warn);
}

.hero-issues .blocking {
  color: var(--import-bad);
}

.placed {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.where {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.72rem;
  color: var(--import-text-dim);
}
</style>

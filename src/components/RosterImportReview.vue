<script setup lang="ts">
/* The roster import's review: every hero the screenshots give, in two grids,
   those to check first and then the ones read surely. A hero is one cell, its
   edits applying to every card of it (the same card seen in several
   screenshots); a hero whose cards disagree on its levels, repeat with an
   unsure card, or stand twice in one screenshot shows each card, named by its
   screenshot and slot and tagged with the issue, to be told apart. Cards no
   hero is taken for come first, then the heroes with an issue. The name opens
   the hero picker with the reader's candidates pinned. Every edit is emitted
   for the import's plan to apply. */

import { computed, ref } from 'vue'

import ImportCellGrid from '@/components/import/ImportCellGrid.vue'
import ImportCellState from '@/components/import/ImportCellState.vue'
import ImportHeroCell from '@/components/import/ImportHeroCell.vue'
import ImportHeroPicker from '@/components/import/ImportHeroPicker.vue'
import type { CardRef, RosterImportShot } from '@/composables/useRosterImport'
import { compareCharacters } from '@/lib/filterOrder'
import type { CellState, ReviewPart } from '@/lib/import/review'
import type { EntryIssue, RosterCard, RosterImportPlan } from '@/lib/rosterImport'
import { useGameDataStore } from '@/stores/gameData'
import { useI18nStore } from '@/stores/i18n'

const { plan, shots } = defineProps<{
  plan: RosterImportPlan
  shots: readonly RosterImportShot[]
}>()

const emit = defineEmits<{
  setHero: [cards: CardRef[], characterId: number | null]
  setLevel: [cards: CardRef[], field: 'paragon' | 'refinement', level: number]
  confirmAll: []
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
  doubtful: ReviewPart[]
  edited: boolean
  issues: EntryIssue[]
  // The screenshot and slot, when the cell is one card of several.
  where: string | null
}

const PARTS: readonly ReviewPart[] = ['hero', 'paragon', 'refinement']

const refs = (cards: readonly RosterCard[]): CardRef[] =>
  cards.map(({ shotId, key }) => ({ shotId, key }))

const cardImage = (card: RosterCard): string =>
  shots.find((s) => s.id === card.shotId)?.cards[card.key] ?? ''

const shotName = (shotId: string): string => shots.find((s) => s.id === shotId)?.name ?? ''

// A cell per card, named by its screenshot and slot, for cards to be told apart.
const cardCells = (cards: readonly RosterCard[], issues: EntryIssue[] = []): CellView[] =>
  cards.map((card) => ({
    key: `${card.shotId}:${card.key}`,
    cards: [card],
    characterId: card.characterId,
    paragon: card.paragon,
    refinement: card.refinement,
    state: card.state,
    doubtful: card.doubtful,
    edited: card.edited,
    issues,
    where: `${shotName(card.shotId)} · ${card.key.toUpperCase()}`,
  }))

// One cell for all of a hero's cards, the first one shown, its state the first
// left to check and its doubts those of any card.
const heroCell = (cards: RosterCard[]): CellView => {
  const first = cards[0]!
  return {
    key: `${first.shotId}:${first.key}`,
    cards,
    characterId: first.characterId,
    paragon: first.paragon,
    refinement: first.refinement,
    state: cards.find((c) => c.state !== 'sure')?.state ?? 'sure',
    doubtful: PARTS.filter((part) => cards.some((c) => c.doubtful.includes(part))),
    edited: cards.some((c) => c.edited),
    issues: [],
    where: null,
  }
}

const heroOrder = (a: number, b: number): number => {
  const first = gameData.getCharacterById(a)
  const second = gameData.getCharacterById(b)
  return first && second ? compareCharacters(first, second) : a - b
}

const byHeroOrder = <T extends { characterId: number }>(entries: T[]): T[] =>
  [...entries].sort((a, b) => heroOrder(a.characterId, b.characterId))

const toCheck = computed(() => {
  const heroes = byHeroOrder(plan.entries.filter((e) => e.check))
  return [
    ...cardCells(plan.unnamed),
    ...heroes.filter((e) => e.issues.length).flatMap((e) => cardCells(e.cards, e.issues)),
    ...heroes.filter((e) => !e.issues.length).map((e) => heroCell(e.cards)),
  ]
})
const sure = computed(() =>
  byHeroOrder(plan.entries.filter((e) => !e.check)).map((e) => heroCell(e.cards)),
)

const ISSUES: readonly EntryIssue[] = ['repeat', 'levels', 'twice']

const ISSUE_TAG: Record<EntryIssue, string> = {
  repeat: 'app.roster-import-same-hero',
  levels: 'app.roster-import-levels-differ',
  twice: 'app.roster-import-read-twice',
}

const ISSUE_TEXT: Record<EntryIssue, string> = {
  repeat: 'app.roster-import-repeat',
  levels: 'app.roster-import-levels',
  twice: 'app.roster-import-twice',
}

// Each tag shown under a card is explained once, above the grid.
const legend = computed(() =>
  ISSUES.filter((issue) => plan.entries.some((e) => e.issues.includes(issue))),
)

const picker = ref<{ key: string; position: { x: number; y: number } } | null>(null)

// The cell as it stands when a hero is picked: a screenshot read while the
// picker is open can add a card to it.
const pickerCell = computed(() => {
  const key = picker.value?.key
  if (!key) return null
  return [...toCheck.value, ...sure.value].find((cell) => cell.key === key) ?? null
})

const togglePicker = (cell: CellView, event: MouseEvent): void => {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  picker.value =
    picker.value?.key === cell.key
      ? null
      : { key: cell.key, position: { x: rect.left, y: rect.bottom + 4 } }
}

const setPicked = (characterId: number | null): void => {
  const cell = pickerCell.value
  picker.value = null
  if (cell) emit('setHero', refs(cell.cards), characterId)
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
    <template v-if="toCheck.length">
      <div class="group-head">
        <span class="group-label">{{ i18n.t('app.roster-import-check-first') }}</span>
        <ImportCellState
          v-if="plan.confirmable.length"
          state="review"
          @confirm="emit('confirmAll')"
        >
          <template #default>
            {{ i18n.t('app.roster-import-confirm-all', { count: plan.confirmable.length }) }}
          </template>
        </ImportCellState>
      </div>
      <ul v-if="legend.length" class="legend">
        <li v-for="issue in legend" :key="issue" class="note">
          <span class="tag" :class="{ blocking: issue !== 'repeat' }">
            {{ i18n.t(ISSUE_TAG[issue]) }}
          </span>
          {{ i18n.t(ISSUE_TEXT[issue]) }}
        </li>
      </ul>
      <ImportCellGrid>
        <div v-for="cell in toCheck" :key="cell.key" class="placed">
          <ImportHeroCell
            :card="cardImage(cell.cards[0]!)"
            :character-id="cell.characterId"
            :paragon="cell.paragon"
            :refinement="cell.refinement"
            :state="cell.state"
            :doubtful="cell.doubtful"
            :edited="cell.edited"
            :open="picker?.key === cell.key"
            @pick="togglePicker(cell, $event)"
            @hero="emit('setHero', refs(cell.cards), $event)"
            @paragon="emit('setLevel', refs(cell.cards), 'paragon', $event)"
            @refinement="emit('setLevel', refs(cell.cards), 'refinement', $event)"
          />
          <span v-if="cell.issues.length" class="tags">
            <span
              v-for="issue in cell.issues"
              :key="issue"
              class="tag"
              :class="{ blocking: issue !== 'repeat' }"
            >
              {{ i18n.t(ISSUE_TAG[issue]) }}
            </span>
          </span>
          <span v-if="cell.where" class="where">{{ cell.where }}</span>
        </div>
      </ImportCellGrid>
    </template>

    <template v-if="sure.length">
      <div class="group-label">{{ i18n.t('app.roster-import-read-surely') }}</div>
      <ImportCellGrid>
        <ImportHeroCell
          v-for="cell in sure"
          :key="cell.key"
          :card="cardImage(cell.cards[0]!)"
          :character-id="cell.characterId"
          :paragon="cell.paragon"
          :refinement="cell.refinement"
          :state="cell.state"
          :doubtful="cell.doubtful"
          :edited="cell.edited"
          :open="picker?.key === cell.key"
          @pick="togglePicker(cell, $event)"
          @hero="emit('setHero', refs(cell.cards), $event)"
          @paragon="emit('setLevel', refs(cell.cards), 'paragon', $event)"
          @refinement="emit('setLevel', refs(cell.cards), 'refinement', $event)"
        />
      </ImportCellGrid>
    </template>

    <ImportHeroPicker
      v-if="picker && pickerCell"
      :position="picker.position"
      :candidates="pickerCell.cards[0]!.cell.candidates"
      :removable="pickerCell.characterId !== null"
      @pick="setPicked"
      @close="picker = null"
    />
  </div>
</template>

<style scoped>
.roster-review {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.group-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm);
}

.legend {
  margin: 0;
  padding: 0;
  list-style: none;
}

.placed {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 8px;
}

.tag {
  font-size: 0.72rem;
  font-weight: 700;
  color: var(--import-warn);
}

.tag.blocking {
  color: var(--import-bad);
}

.where {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.72rem;
  color: var(--import-text-dim);
}
</style>

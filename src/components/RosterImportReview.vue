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

import ImportCellGrid from '@/components/import/ImportCellGrid.vue'
import ImportHeroCell from '@/components/import/ImportHeroCell.vue'
import ImportHeroPicker from '@/components/import/ImportHeroPicker.vue'
import type { CardRef, RosterImportShot } from '@/composables/useRosterImport'
import { compareCharacters } from '@/lib/filterOrder'
import type { CellState } from '@/lib/import/review'
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

const heroOrder = (a: number, b: number): number => {
  const first = gameData.getCharacterById(a)
  const second = gameData.getCharacterById(b)
  return first && second ? compareCharacters(first, second) : a - b
}

const byHeroOrder = <T extends { characterId: number }>(entries: T[]): T[] =>
  [...entries].sort((a, b) => heroOrder(a.characterId, b.characterId))

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

const picker = ref<{ key: string; position: { x: number; y: number } } | null>(null)

// The cell as it stands when a hero is picked: a screenshot read while the
// picker is open can add a card to it.
const pickerCell = computed(() => {
  const key = picker.value?.key
  if (!key) return null
  return (
    [...unnamed.value, ...toCheck.value.flatMap((hero) => hero.cells), ...sure.value].find(
      (cell) => cell.key === key,
    ) ?? null
  )
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
    <template v-if="toCheck.length || unnamed.length">
      <div class="group-label">{{ i18n.t('app.roster-import-check-first') }}</div>
      <ImportCellGrid v-if="unnamed.length">
        <div v-for="cell in unnamed" :key="cell.key" class="placed">
          <ImportHeroCell
            :card="cardImage(cell.cards[0]!)"
            :character-id="cell.characterId"
            :paragon="cell.paragon"
            :refinement="cell.refinement"
            :state="cell.state"
            :edited="cell.edited"
            :open="picker?.key === cell.key"
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
              :open="picker?.key === cell.key"
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

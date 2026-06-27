<script setup lang="ts">
import { computed, ref } from 'vue'
import { useHead } from '@unhead/vue'

import WandWarsAnalysis from '@/components/wandwars/WandWarsAnalysis.vue'
import WandWarsMain from '@/components/wandwars/WandWarsMain.vue'
import { useGameDataStore } from '@/stores/gameData'
import { useI18nStore } from '@/stores/i18n'
import { downloadBlob } from '@/utils/download'
import { DRAFT_ORDER } from '@/wandwars/constants'
import { getAnalysisData, getMatchData } from '@/wandwars/prediction/recommend'
import { serializeMatches } from '@/wandwars/records/serializer'
import type { PickSide, PickState, RecordedMatch } from '@/wandwars/types'

const gameDataStore = useGameDataStore()
gameDataStore.initializeData()

useI18nStore().initialize()

useHead({
  link: [{ rel: 'canonical', href: 'https://stargazer.tmdict.com/wandwars' }],
})

const mainTab = ref<'draft' | 'hero-adjustments'>('draft')

const pickState = ref<PickState>({
  left: [null, null, null],
  right: [null, null, null],
})

const pickHistory = ref<{ side: PickSide; slot: number; hero: string }[]>([])

const RECORDS_STORAGE_KEY = 'stargazer.wandwars.records'

function isRecordedMatch(value: unknown): value is RecordedMatch {
  if (typeof value !== 'object' || value === null) return false
  const r = value as Record<string, unknown>
  return (
    Array.isArray(r.left) &&
    r.left.length === 3 &&
    r.left.every((s) => typeof s === 'string') &&
    Array.isArray(r.right) &&
    r.right.length === 3 &&
    r.right.every((s) => typeof s === 'string') &&
    (r.winner === 'left' || r.winner === 'right' || r.winner === 'draw') &&
    typeof r.dominant === 'boolean' &&
    typeof r.notes === 'string'
  )
}

function loadRecords(): RecordedMatch[] {
  if (import.meta.env.SSR) return []
  try {
    const stored = localStorage.getItem(RECORDS_STORAGE_KEY)
    if (!stored) return []
    const parsed: unknown = JSON.parse(stored)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isRecordedMatch)
  } catch (err) {
    console.warn('WandWars: failed to parse stored records, resetting to empty.', err)
    return []
  }
}

function saveRecords() {
  localStorage.setItem(RECORDS_STORAGE_KEY, JSON.stringify(records.value))
}

const records = ref<RecordedMatch[]>(loadRecords())

const matchData = computed(() => getMatchData())
const analysisData = computed(() => getAnalysisData())

const allHeroes = computed(() => analysisData.value.allHeroes)

const poolFilter = ref<string[] | null>(null)

const effectiveHeroes = computed(() => {
  if (!poolFilter.value) return allHeroes.value
  const poolSet = new Set(poolFilter.value)
  return allHeroes.value.filter((h) => poolSet.has(h))
})

const pickedHeroes = computed(() => {
  const picked = new Set<string>()
  for (const hero of pickState.value.left) {
    if (hero) picked.add(hero)
  }
  for (const hero of pickState.value.right) {
    if (hero) picked.add(hero)
  }
  return picked
})

const availableHeroes = computed(() =>
  effectiveHeroes.value.filter((h) => !pickedHeroes.value.has(h)),
)

const effectiveHeroSet = computed(() => new Set(effectiveHeroes.value))

const characters = computed(() =>
  gameDataStore.characters.filter((c) => effectiveHeroSet.value.has(c.name)),
)

function handleSetPool(pool: string[]) {
  poolFilter.value = pool
}

const currentDraftIndex = computed(() => {
  let index = 0
  for (const [side, slot] of DRAFT_ORDER) {
    if (pickState.value[side][slot] === null) return index
    index++
  }
  return index
})

function getNextDraftSlot(): { side: PickSide; slot: number } | null {
  const idx = currentDraftIndex.value
  if (idx >= DRAFT_ORDER.length) return null
  return { side: DRAFT_ORDER[idx]![0], slot: DRAFT_ORDER[idx]![1] }
}

const currentPickSide = computed<PickSide | null>(() => {
  const next = getNextDraftSlot()
  return next ? next.side : null
})

function handlePickHero(hero: string) {
  if (pickedHeroes.value.has(hero)) return
  const next = getNextDraftSlot()
  if (!next) return
  pickState.value[next.side][next.slot] = hero
  pickHistory.value.push({ side: next.side, slot: next.slot, hero })
}

function handleUnpickSlot(side: PickSide, slot: number) {
  const hero = pickState.value[side][slot]
  if (!hero) return
  pickState.value[side][slot] = null
  pickHistory.value = pickHistory.value.filter((h) => !(h.side === side && h.slot === slot))
}

function handleUndo() {
  const last = pickHistory.value.pop()
  if (!last) return
  pickState.value[last.side][last.slot] = null
}

function handleReset() {
  pickState.value = { left: [null, null, null], right: [null, null, null] }
  pickHistory.value = []
  poolFilter.value = null
}

function handleRecordMatch(record: RecordedMatch) {
  records.value.push(record)
  saveRecords()
  handleReset()
}

function handleImportRecords(imported: RecordedMatch[]) {
  records.value = imported
  saveRecords()
}

function handleUpdateRecord(index: number, changes: Partial<RecordedMatch>) {
  const existing = records.value[index]
  if (!existing) return
  records.value[index] = { ...existing, ...changes }
  saveRecords()
}

function handleDeleteRecord(index: number) {
  records.value.splice(index, 1)
  saveRecords()
}

function handleClearRecords() {
  records.value = []
  localStorage.removeItem(RECORDS_STORAGE_KEY)
}

function handleExport() {
  const content = serializeMatches(records.value)
  downloadBlob(new Blob([content], { type: 'text/plain' }), 'wandwars-recorded.data')
}
</script>

<template>
  <main class="wandwars-page">
    <div class="wandwars-layout">
      <WandWarsMain
        class="wandwars-main"
        v-model:active-tab="mainTab"
        :pick-state="pickState"
        :current-pick-side="currentPickSide"
        :characters="characters"
        :all-heroes="allHeroes"
        :available-heroes="availableHeroes"
        :character-images="gameDataStore.characterImages"
        @pick-hero="handlePickHero"
        @unpick-slot="handleUnpickSlot"
        @reset="handleReset"
        @undo="handleUndo"
        @set-pool="handleSetPool"
      />

      <aside v-if="mainTab === 'draft'" class="wandwars-side">
        <WandWarsAnalysis
          :pick-state="pickState"
          :current-pick-side="currentPickSide"
          :match-data="matchData"
          :character-images="gameDataStore.characterImages"
          :records="records"
          :pool-filter="poolFilter"
          @record-match="handleRecordMatch"
          @delete-record="handleDeleteRecord"
          @clear-records="handleClearRecords"
          @export="handleExport"
          @import-records="handleImportRecords"
          @update-record="handleUpdateRecord"
        />
      </aside>
    </div>
  </main>
</template>

<style scoped>
.wandwars-page {
  min-height: 100vh;
  background: #20232a;
}

/* WandWarsMain (left) is fluid; the aside (right) is fixed-width 780px.
   Drafting benefits from horizontal room; analysis cards have natural
   max-widths. Stacks single-column below 1220px. The Adjustments tab
   hides the aside, leaving the lone fluid child to fill the row. */
.wandwars-layout {
  display: flex;
  flex-direction: column;
  gap: var(--stack-gap);
  width: 100%;
}

@media (min-width: 1220px) {
  .wandwars-layout {
    flex-direction: row;
    align-items: flex-start;
  }

  /* min-width: 0 prevents tables / tooltips / wide content from blowing
     out the flex item. */
  .wandwars-layout > .wandwars-main {
    flex: 1 1 auto;
    min-width: 0;
  }

  /* Capped at viewport height so long content (recommendation lists,
     records lists) doesn't drag the page taller than the window. The
     :has() overrides below release the cap for content-sized layouts. */
  .wandwars-layout > .wandwars-side {
    display: flex;
    flex-direction: column;
    flex: 0 0 780px;
    width: 780px;
    max-height: 100vh;
  }

  /* Fill the column height so the aside's child (.analysis) handles long
     lists via its own internal .tab-content scroll. Tabs stay pinned at
     the top instead of scrolling away with the page. */
  .wandwars-layout > .wandwars-side > * {
    flex: 1;
    min-height: 0;
  }

  /* Release the cap when the aside hosts the full match prediction view
     (all 6 picked) so the matchup cards + record form flow without an
     inner scrollbar. */
  .wandwars-layout > .wandwars-side:has(.matchup-section) {
    max-height: none;
  }

  .wandwars-layout > .wandwars-side:has(.matchup-section) > * {
    flex: initial;
    min-height: initial;
  }
}
</style>

<script setup lang="ts">
import { computed, ref } from 'vue'

import WandWarsAnalysis from '@/components/wandwars/WandWarsAnalysis.vue'
import WandWarsInsights from '@/components/wandwars/WandWarsInsights.vue'
import WandWarsMain from '@/components/wandwars/WandWarsMain.vue'
import { useGameDataStore } from '@/stores/gameData'
import { useI18nStore } from '@/stores/i18n'
import { DRAFT_ORDER } from '@/wandwars/constants'
import { getAnalysisData, getMatchData } from '@/wandwars/prediction/recommend'
import { serializeMatches } from '@/wandwars/records/serializer'
import type { PickSide, PickState, RecordedMatch } from '@/wandwars/types'

const gameDataStore = useGameDataStore()
gameDataStore.initializeData()

useI18nStore().initialize()

const mainTab = ref<'draft' | 'units' | 'teams' | 'synergy' | 'hero-adjustments'>('draft')

const pickState = ref<PickState>({
  left: [null, null, null],
  right: [null, null, null],
})

const pickHistory = ref<{ side: PickSide; slot: number; hero: string }[]>([])

const RECORDS_STORAGE_KEY = 'stargazer.wandwars.records'

function loadRecords(): RecordedMatch[] {
  try {
    const stored = localStorage.getItem(RECORDS_STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
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

function handleClearPool() {
  poolFilter.value = null
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

function handleUpdateRecord(index: number, patch: Partial<RecordedMatch>) {
  const existing = records.value[index]
  if (!existing) return
  records.value[index] = { ...existing, ...patch }
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
  const blob = new Blob([content], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'wandwars-recorded.data'
  a.click()
  URL.revokeObjectURL(url)
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
        :match-data="matchData"
        :analysis-data="analysisData"
        :pool-filter="poolFilter"
        @pick-hero="handlePickHero"
        @unpick-slot="handleUnpickSlot"
        @reset="handleReset"
        @undo="handleUndo"
        @set-pool="handleSetPool"
        @clear-pool="handleClearPool"
      />

      <aside v-if="mainTab !== 'hero-adjustments'" class="wandwars-side">
        <WandWarsAnalysis
          v-if="mainTab === 'draft'"
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
        <WandWarsInsights
          v-else
          :category="mainTab"
          :match-data="matchData"
          :analysis-data="analysisData"
          :character-images="gameDataStore.characterImages"
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

/* Flex layout (one fixed column + one fluid) modeled on HomeView's
   `.sections-container`. Note the fluid/fixed direction is reversed from
   HomeView: WandWarsMain (left) is fluid, the aside (right) is the fixed
   740px column — chosen because drafting and meta tables benefit from
   horizontal room while analysis cards have natural max-widths. Stacked
   single-column by default; two-column row at >=1200px. Hero Adjustments
   (no `<aside>`) collapses automatically — the lone child fills the row. */
.wandwars-layout {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xl);
  width: 100%;
}

.wandwars-side {
  display: flex;
  flex-direction: column;
}

@media (min-width: 1200px) {
  .wandwars-layout {
    flex-direction: row;
    align-items: flex-start;
  }

  /* Left column: fluid drafting / meta tables / hero adjustments. min-width: 0
     prevents tables / tooltips / wide content from blowing out the flex item. */
  .wandwars-layout > .wandwars-main {
    flex: 1 1 auto;
    min-width: 0;
  }

  /* Right column: fixed-width analysis / insights. Capped at viewport height
     so long content (recommendation lists, records lists) doesn't drag the
     page taller than the window. The :has() overrides below release the cap
     for content-sized layouts. */
  .wandwars-layout > .wandwars-side {
    flex: 0 0 740px;
    width: 740px;
    max-height: 100vh;
  }

  /* Force the aside's direct child (.analysis root) to fill the column
     height. This lets .analysis's internal .tab-content scroll handle long
     lists (recommendations or records) internally — tabs stay pinned at
     the top of the column instead of scrolling away. */
  .wandwars-layout > .wandwars-side > * {
    flex: 1;
    min-height: 0;
  }

  /* Release the cap when the aside hosts naturally-sized content:
     - `.matchup-section` → full match prediction view (all 6 picked) so
       the matchup cards + record form flow without an inner scrollbar
     - `.insights-panel` → meta pages (Units / Teams / Synergy) own their
       own variable-length section layout */
  .wandwars-layout > .wandwars-side:has(.matchup-section),
  .wandwars-layout > .wandwars-side:has(.insights-panel) {
    max-height: none;
  }

  .wandwars-layout > .wandwars-side:has(.matchup-section) > *,
  .wandwars-layout > .wandwars-side:has(.insights-panel) > * {
    flex: initial;
    min-height: initial;
  }
}
</style>

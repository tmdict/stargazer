<template>
  <div class="wandwars-page">
    <div class="wandwars-layout">
      <div class="wandwars-left">
        <WandWarsPicker
          v-model:active-tab="leftTab"
          :pick-state="pickState"
          :current-pick-side="currentPickSide"
          :characters="characters"
          :all-heroes="allHeroes"
          :available-heroes="availableHeroes"
          :character-images="characterImages"
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
      </div>

      <div class="wandwars-right">
        <WandWarsAnalysis
          v-if="leftTab === 'draft'"
          :pick-state="pickState"
          :current-pick-side="currentPickSide"
          :match-data="matchData"
          :character-images="characterImages"
          :records="records"
          :pool-filter="poolFilter"
          @record-match="handleRecordMatch"
          @delete-record="handleDeleteRecord"
          @clear-records="handleClearRecords"
          @reset="handleReset"
          @export="handleExport"
        />
        <WandWarsInsights
          v-else
          :category="leftTab"
          :match-data="matchData"
          :analysis-data="analysisData"
          :character-images="characterImages"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import WandWarsAnalysis from '@/components/wandwars/WandWarsAnalysis.vue'
import WandWarsInsights from '@/components/wandwars/WandWarsInsights.vue'
import WandWarsPicker from '@/components/wandwars/WandWarsPicker.vue'
import { useGameDataStore } from '@/stores/gameData'
import { useI18nStore } from '@/stores/i18n'
import { DRAFT_ORDER } from '@/wandwars/constants'
import { getAnalysisData, getMatchData } from '@/wandwars/recommend'
import { serializeMatches } from '@/wandwars/serializer'
import type { PickSide, PickState, RecordedMatch } from '@/wandwars/types'

const gameDataStore = useGameDataStore()
gameDataStore.initializeData()

useI18nStore().initialize()

const leftTab = ref<'draft' | 'units' | 'teams' | 'synergy'>('draft')

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

const characterImages = computed(() => gameDataStore.characterImages)

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

<style scoped>
.wandwars-page {
  width: 100%;
  max-width: 1600px;
  margin: 0 auto;
  padding: var(--spacing-lg) var(--spacing-xl);
  min-height: 100vh;
  background: var(--color-bg-primary);
}

.wandwars-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: var(--spacing-xl);
  align-items: start;
}

@media (max-width: 768px) {
  .wandwars-page {
    padding: var(--spacing-md);
  }

  .wandwars-layout {
    grid-template-columns: 1fr;
  }
}
</style>

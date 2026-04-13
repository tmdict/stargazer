<template>
  <div class="analysis">
    <div class="tabs">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        :class="['tab-btn', { active: activeTab === tab.id }]"
        @click="activeTab = tab.id"
      >
        {{ tab.label }}
        <span v-if="tab.id === 'records' && records.length > 0" class="tab-count">
          {{ records.length }}
        </span>
      </button>
    </div>

    <!-- Records tab -->
    <div v-if="activeTab === 'records'" class="tab-content">
      <div v-if="records.length > 0" class="records-section">
        <div class="records-list">
          <div v-for="(record, i) in records" :key="i" class="record-entry">
            <div class="record-row">
              <span class="record-teams">
                {{ record.left.join(',') }}
                {{ formatSymbol(record) }}
                {{ record.right.join(',') }}
              </span>
              <button class="delete-btn" @click="emit('deleteRecord', i)">✕</button>
            </div>
            <div v-if="record.notes" class="record-notes-text">
              {{ record.notes }}
            </div>
          </div>
        </div>

        <div class="records-actions">
          <button class="export-btn" @click="handleCopy">
            {{ copyLabel }}
          </button>
          <button class="export-btn" @click="emit('export')">Export .data</button>
          <button class="export-btn danger" @click="emit('clearRecords')">Clear All</button>
        </div>
      </div>

      <div v-else class="empty-state">
        No matches recorded yet. Pick 6 heroes, see the prediction, then record the result.
      </div>
    </div>

    <!-- Model tabs -->
    <div v-else class="tab-content">
      <div
        v-if="activeTab === 'bradley-terry' && matchData.length < BT_LOW_DATA_THRESHOLD"
        class="warning-banner"
      >
        Limited data ({{ matchData.length }} matches) — estimates may be unreliable. Prefer Hero
        Synergy tab.
      </div>

      <!-- Matchup predictions when all 6 heroes are picked -->
      <div v-if="sortedPredictions.length > 0" class="matchup-section">
        <!-- Primary prediction (active tab's model) -->
        <div
          v-for="(pred, idx) in sortedPredictions"
          :key="pred.id"
          :class="['matchup-prediction', { secondary: idx > 0 }]"
        >
          <div class="matchup-header">
            <h3 class="matchup-title">{{ idx === 0 ? 'Matchup Prediction' : pred.name }}</h3>
            <span
              :class="['confidence-badge', pred.prediction.confidence]"
              :title="confidenceDescriptions[pred.prediction.confidence]"
            >
              {{ pred.prediction.confidence }} confidence
            </span>
          </div>
          <div class="matchup-bars">
            <div class="matchup-side left">
              <span class="matchup-label">Left</span>
              <span class="matchup-percent">{{
                formatPercent(pred.prediction.leftWinProbability)
              }}</span>
            </div>
            <div class="matchup-bar-track">
              <div
                class="matchup-bar-fill left"
                :style="{ width: formatPercent(pred.prediction.leftWinProbability) }"
              />
            </div>
            <div class="matchup-side right">
              <span class="matchup-percent">{{
                formatPercent(pred.prediction.rightWinProbability)
              }}</span>
              <span class="matchup-label">Right</span>
            </div>
          </div>
          <div v-if="idx === 0" class="matchup-verdict">
            <template v-if="pred.prediction.leftWinProbability > 0.55">
              <strong>Left</strong> team favored
            </template>
            <template v-else-if="pred.prediction.rightWinProbability > 0.55">
              <strong>Right</strong> team favored
            </template>
            <template v-else> Close matchup — could go either way </template>
          </div>
          <div v-if="idx === 0 && pred.prediction.relevantNotes.length > 0" class="matchup-notes">
            <div
              v-for="(note, i) in pred.prediction.relevantNotes.slice(0, 5)"
              :key="i"
              class="matchup-note"
              v-html="formatNoteHtml(note.text)"
            />
          </div>
        </div>

        <!-- Quick record form -->
        <div class="record-form">
          <h4 class="record-form-title">Save Result</h4>
          <div class="result-buttons">
            <button
              :class="['result-btn', 'left', 'dominant', { active: resultKey === 'left-dominant' }]"
              @click="setResult('left', true)"
            >
              Left Win (Sweep)
            </button>
            <button
              :class="['result-btn', 'left', { active: resultKey === 'left-normal' }]"
              @click="setResult('left', false)"
            >
              Left Win
            </button>
            <button
              :class="['result-btn', 'draw', { active: resultKey === 'draw' }]"
              @click="setResult('draw', false)"
            >
              Draw
            </button>
            <button
              :class="['result-btn', 'right', { active: resultKey === 'right-normal' }]"
              @click="setResult('right', false)"
            >
              Right Win
            </button>
            <button
              :class="[
                'result-btn',
                'right',
                'dominant',
                { active: resultKey === 'right-dominant' },
              ]"
              @click="setResult('right', true)"
            >
              Right Win (Sweep)
            </button>
          </div>
          <textarea
            v-model="recordNotes"
            class="notes-input"
            rows="2"
            placeholder="Optional notes... use {heroName} to reference heroes"
          />
          <button class="submit-btn" @click="handleRecordSubmit">Save Result</button>
          <button class="reset-btn" @click="emit('reset')">Reset Teams</button>
        </div>
      </div>

      <!-- Recommendations while drafting -->
      <template v-else>
        <div :class="['picking-indicator', currentPickSide]">
          Recommending for <strong>{{ pickingSideLabel }}</strong> side
        </div>

        <div v-if="recommendations.length === 0" class="empty-state">
          Pick heroes to see recommendations.
        </div>

        <div v-else class="recommendations">
          <WandWarsRecommendation
            v-for="(rec, i) in recommendations"
            :key="rec.hero"
            :recommendation="rec"
            :rank="i + 1"
            :model-id="activeTab"
            :character-images="characterImages"
          />
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import WandWarsRecommendation from './WandWarsRecommendation.vue'
import { BT_LOW_DATA_THRESHOLD, CONFIDENCE_DESCRIPTIONS } from '@/wandwars/constants'
import { formatNoteHtml, formatPercent, getResultSymbol } from '@/wandwars/formatting'
import { getAllMatchupPredictions, getRecommendations } from '@/wandwars/recommend'
import { serializeMatches } from '@/wandwars/serializer'
import type { MatchResult, PickSide, PickState, RecordedMatch } from '@/wandwars/types'

const props = defineProps<{
  pickState: PickState
  currentPickSide: PickSide | null
  matchData: MatchResult[]
  characterImages: Record<string, string>
  records: RecordedMatch[]
}>()

const emit = defineEmits<{
  recordMatch: [record: RecordedMatch]
  deleteRecord: [index: number]
  clearRecords: []
  reset: []
  export: []
}>()

const tabs = [
  { id: 'meta-pick', label: 'Meta Pick' },
  { id: 'composite', label: 'Hero Synergy (Composite Model)' },
  { id: 'bradley-terry', label: 'Total Team Power (B-T Model)' },
  { id: 'records', label: 'Records' },
]

const activeTab = ref('meta-pick')

// Record form state
const recordWinner = ref<'left' | 'right' | 'draw'>('left')
const recordDominant = ref(false)
const recordNotes = ref('')

const resultKey = computed(() => {
  if (recordWinner.value === 'draw') return 'draw'
  return `${recordWinner.value}-${recordDominant.value ? 'dominant' : 'normal'}`
})

function setResult(w: 'left' | 'right' | 'draw', d: boolean) {
  recordWinner.value = w
  recordDominant.value = d
}

function handleRecordSubmit() {
  emit('recordMatch', {
    left: [...props.pickState.left] as [string, string, string],
    right: [...props.pickState.right] as [string, string, string],
    winner: recordWinner.value,
    dominant: recordWinner.value !== 'draw' && recordDominant.value,
    notes: recordNotes.value.trim(),
  })
  recordWinner.value = 'left'
  recordDominant.value = false
  recordNotes.value = ''
}

const copyLabel = ref('Copy Data')

async function handleCopy() {
  const content = serializeMatches(props.records)
  await navigator.clipboard.writeText(content)
  copyLabel.value = 'Copied!'
  setTimeout(() => {
    copyLabel.value = 'Copy Data'
  }, 2000)
}

function formatSymbol(record: RecordedMatch): string {
  return getResultSymbol(record.winner, record.dominant)
}

const confidenceDescriptions = CONFIDENCE_DESCRIPTIONS

const pickingSideLabel = computed(() => (props.currentPickSide === 'left' ? 'Left' : 'Right'))

const myTeam = computed(() => {
  if (!props.currentPickSide) return []
  return props.pickState[props.currentPickSide].filter((h): h is string => h !== null)
})

const opponentSide = computed<PickSide>(() => (props.currentPickSide === 'left' ? 'right' : 'left'))

const opponentTeam = computed(() => {
  if (!props.currentPickSide) return []
  return props.pickState[opponentSide.value].filter((h): h is string => h !== null)
})

const allPickedHeroes = computed(() => [
  ...props.pickState.left.filter((h): h is string => h !== null),
  ...props.pickState.right.filter((h): h is string => h !== null),
])

const allPicked = computed(() => allPickedHeroes.value.length >= 6)

const recommendations = computed(() => {
  if (allPicked.value) return []
  return getRecommendations(
    activeTab.value,
    myTeam.value,
    opponentTeam.value,
    allPickedHeroes.value,
  )
})

const leftTeam = computed(() => props.pickState.left.filter((h): h is string => h !== null))

const rightTeam = computed(() => props.pickState.right.filter((h): h is string => h !== null))

const allPredictions = computed(() => {
  if (!allPicked.value) return []
  return getAllMatchupPredictions(leftTeam.value, rightTeam.value)
})

// Active tab's prediction first, then others
const sortedPredictions = computed(() => {
  if (allPredictions.value.length === 0) return []
  const active = allPredictions.value.find((p) => p.id === activeTab.value)
  const others = allPredictions.value.filter((p) => p.id !== activeTab.value)
  return active ? [active, ...others] : allPredictions.value
})
</script>

<style scoped>
.analysis {
  background: var(--color-bg-white);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-large);
  padding: var(--spacing-lg);
}

.tabs {
  display: flex;
  gap: 2px;
  margin-bottom: var(--spacing-md);
  border-bottom: 2px solid var(--color-border-light);
}

.tab-btn {
  padding: var(--spacing-xs) var(--spacing-md);
  border: none;
  background: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  font-size: 0.8rem;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  transition:
    color var(--transition-fast),
    border-color var(--transition-fast);
}

.tab-btn.active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
  font-weight: 600;
}

.tab-btn:hover:not(.active) {
  color: var(--color-text-primary);
}

.tab-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border-radius: 9px;
  background: var(--color-primary);
  color: white;
  font-size: 0.65rem;
  font-weight: 700;
  margin-left: 4px;
}

.picking-indicator {
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-small);
  font-size: 0.8rem;
  margin-bottom: var(--spacing-sm);
  text-align: center;
  transition:
    background var(--transition-fast),
    border-color var(--transition-fast);
}

.picking-indicator.left {
  background: rgba(54, 149, 142, 0.1);
  border: 1px solid var(--color-ally);
  color: var(--color-ally);
}

.picking-indicator.right {
  background: rgba(200, 35, 51, 0.1);
  border: 1px solid var(--color-enemy);
  color: var(--color-enemy);
}

.warning-banner {
  background: #fff8e1;
  border: 1px solid #f9a825;
  border-radius: var(--radius-small);
  padding: var(--spacing-sm);
  font-size: 0.75rem;
  color: #e65100;
  margin-bottom: var(--spacing-md);
}

.recommendations {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  max-height: calc(100vh - 200px);
  overflow-y: auto;
}

.empty-state {
  text-align: center;
  color: var(--color-text-secondary);
  padding: var(--spacing-2xl);
  font-size: 0.85rem;
}

/* Matchup prediction */
.matchup-section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.matchup-prediction {
  padding: var(--spacing-md);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-medium);
  background: var(--color-bg-tertiary);
}

.matchup-prediction.secondary {
  padding: var(--spacing-sm);
  background: var(--color-bg-white);
  border: 1px solid var(--color-border-light);
  opacity: 0.85;
}

.matchup-prediction.secondary .matchup-title {
  font-size: 0.8rem;
  color: var(--color-text-secondary);
}

.matchup-prediction.secondary .matchup-percent {
  font-size: 0.9rem;
}

.matchup-prediction.secondary .matchup-bar-track {
  height: 8px;
}

.matchup-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-md);
}

.matchup-title {
  margin: 0;
  font-size: 1rem;
  color: var(--color-text-primary);
}

.confidence-badge {
  font-size: 0.7rem;
  padding: 3px 8px;
  border-radius: var(--radius-small);
  text-transform: uppercase;
}

.confidence-badge.high {
  background: #e6f4ea;
  color: #1e7e34;
}

.confidence-badge.medium {
  background: #fff8e1;
  color: #f9a825;
}

.confidence-badge.low {
  background: #fce4ec;
  color: #c62828;
}

.matchup-bars {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.matchup-side {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  min-width: 60px;
}

.matchup-side.right {
  text-align: right;
}

.matchup-label {
  font-size: 0.7rem;
  text-transform: uppercase;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.matchup-side.left .matchup-label {
  color: var(--color-ally);
}

.matchup-side.right .matchup-label {
  color: var(--color-enemy);
}

.matchup-percent {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--color-text-primary);
}

.matchup-bar-track {
  flex: 1;
  height: 12px;
  background: var(--color-enemy);
  border-radius: 6px;
  overflow: hidden;
}

.matchup-bar-fill {
  height: 100%;
  border-radius: 6px;
  transition: width var(--transition-medium);
}

.matchup-bar-fill.left {
  background: var(--color-ally);
}

.matchup-verdict {
  text-align: center;
  margin-top: var(--spacing-md);
  font-size: 0.9rem;
  color: var(--color-text-primary);
}

.matchup-notes {
  margin-top: var(--spacing-md);
  padding-top: var(--spacing-sm);
  border-top: 1px solid var(--color-border-light);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.matchup-note {
  font-size: 0.85rem;
  color: var(--color-text-secondary);
  font-style: italic;
  line-height: 1.4;
}

.matchup-note :deep(.hero-highlight) {
  color: var(--color-primary);
  font-style: normal;
}

/* Quick record form */
.record-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  padding: var(--spacing-md);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-medium);
  background: var(--color-bg-white);
}

.record-form-title {
  margin: 0;
  font-size: 0.9rem;
  color: var(--color-text-primary);
}

.result-buttons {
  display: flex;
  gap: 2px;
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-medium);
  overflow: hidden;
}

.result-btn {
  flex: 1;
  padding: var(--spacing-md) var(--spacing-xs);
  border: none;
  background: var(--color-bg-white);
  color: var(--color-text-secondary);
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
  transition:
    background var(--transition-fast),
    color var(--transition-fast);
}

.result-btn.left.active {
  background: var(--color-ally);
  color: white;
}

.result-btn.left.dominant.active {
  background: var(--color-ally);
  color: white;
  font-weight: 700;
}

.result-btn.draw.active {
  background: var(--color-text-secondary);
  color: white;
}

.result-btn.right.active {
  background: var(--color-enemy);
  color: white;
}

.result-btn.right.dominant.active {
  background: var(--color-enemy);
  color: white;
  font-weight: 700;
}

.result-btn:hover:not(.active) {
  background: var(--color-bg-secondary);
}

.notes-input {
  width: 100%;
  padding: var(--spacing-sm);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-small);
  font-size: 0.8rem;
  font-family: inherit;
  background: var(--color-bg-white);
  resize: vertical;
}

.notes-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.submit-btn {
  padding: var(--spacing-md) var(--spacing-lg);
  background: var(--color-primary);
  color: white;
  border: none;
  border-radius: var(--radius-medium);
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
  transition: background var(--transition-fast);
}

.submit-btn:hover {
  background: var(--color-primary-hover);
}

.reset-btn {
  padding: var(--spacing-md) var(--spacing-lg);
  background: var(--color-bg-white);
  color: var(--color-danger);
  border: 1px solid var(--color-danger);
  border-radius: var(--radius-medium);
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
  transition: background var(--transition-fast);
}

.reset-btn:hover {
  background: var(--color-danger);
  color: white;
}

/* Records list */
.records-section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.records-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 500px;
  overflow-y: auto;
}

.record-entry {
  background: var(--color-bg-tertiary);
  border-radius: var(--radius-small);
  padding: var(--spacing-sm);
}

.record-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  font-size: 0.8rem;
}

.record-teams {
  flex: 1;
  color: var(--color-text-primary);
  font-family: monospace;
}

.record-notes-text {
  margin-top: var(--spacing-xs);
  padding-top: var(--spacing-xs);
  border-top: 1px solid var(--color-border-light);
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  font-style: italic;
  line-height: 1.4;
}

.delete-btn {
  background: none;
  border: none;
  color: var(--color-danger);
  cursor: pointer;
  font-size: 0.85rem;
  padding: 2px 4px;
  border-radius: var(--radius-small);
  transition: background var(--transition-fast);
}

.delete-btn:hover {
  background: rgba(192, 91, 77, 0.1);
}

.records-actions {
  display: flex;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-sm);
}

.export-btn {
  flex: 1;
  padding: var(--spacing-md) var(--spacing-lg);
  background: var(--color-bg-white);
  color: var(--color-primary);
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-medium);
  cursor: pointer;
  font-size: 0.85rem;
  font-weight: 600;
  transition: background var(--transition-fast);
}

.export-btn:hover {
  background: var(--color-primary);
  color: white;
}

.export-btn.danger {
  color: var(--color-danger);
  border-color: var(--color-danger);
}

.export-btn.danger:hover {
  background: var(--color-danger);
  color: white;
}
</style>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import WandWarsRecommendation from './WandWarsRecommendation.vue'
import type { CounterIndicator, TeamCounterInfo } from './WandWarsRecommendation.vue'
import WandWarsTopTeams from './WandWarsTopTeams.vue'
import FilterIcons from '@/components/ui/FilterIcons.vue'
import IconInfo from '@/components/ui/IconInfo.vue'
import TooltipPopup from '@/components/ui/TooltipPopup.vue'
import { useGameDataStore } from '@/stores/gameData'
import { useI18nStore } from '@/stores/i18n'
import { BT_LOW_DATA_THRESHOLD } from '@/wandwars/constants'
import { formatName, formatNoteHtml, formatPercent, joinLocale } from '@/wandwars/formatting'
import {
  getAggregatePrediction,
  getAllMatchupPredictions,
  getAnalysisData,
  getMatchData,
  getRecommendations,
} from '@/wandwars/prediction/recommend'
import { parseMatchData } from '@/wandwars/records/parser'
import { serializeMatches } from '@/wandwars/records/serializer'
import type { MatchResult, PickSide, PickState, RecordedMatch } from '@/wandwars/types'

const gameDataStore = useGameDataStore()
const i18n = useI18nStore()

const props = defineProps<{
  pickState: PickState
  currentPickSide: PickSide | null
  matchData: MatchResult[]
  characterImages: Record<string, string>
  records: RecordedMatch[]
  poolFilter: string[] | null
}>()

const emit = defineEmits<{
  recordMatch: [record: RecordedMatch]
  deleteRecord: [index: number]
  clearRecords: []
  export: []
  importRecords: [records: RecordedMatch[]]
  updateRecord: [index: number, patch: Partial<RecordedMatch>]
}>()

const importInput = ref<HTMLInputElement | null>(null)

// Store status as semantic state so language switches re-render reactively.
type ImportStatusState =
  | { kind: 'none' }
  | { kind: 'no-records' }
  | { kind: 'imported'; count: number }
  | { kind: 'failed'; error: string }
const importStatusState = ref<ImportStatusState>({ kind: 'none' })
const importStatus = computed(() => {
  const s = importStatusState.value
  if (s.kind === 'none') return ''
  if (s.kind === 'no-records') return i18n.t('wandwars.messages/import-no-records')
  if (s.kind === 'imported') {
    const key =
      s.count === 1
        ? 'wandwars.messages/imported-record-singular'
        : 'wandwars.messages/imported-records'
    return i18n.t(key).replace('{count}', String(s.count))
  }
  return i18n.t('wandwars.messages/import-failed').replace('{error}', s.error)
})

const editingIndex = ref<number | null>(null)
const editWinner = ref<'left' | 'right' | 'draw'>('left')
const editDominant = ref(false)
const editNotes = ref('')

const editResultKey = computed(() => {
  if (editWinner.value === 'draw') return 'draw'
  return `${editWinner.value}-${editDominant.value ? 'dominant' : 'normal'}`
})

function setEditResult(w: 'left' | 'right' | 'draw', d: boolean) {
  editWinner.value = w
  editDominant.value = d
}

function startEdit(i: number) {
  const r = props.records[i]
  if (!r) return
  editingIndex.value = i
  editWinner.value = r.winner
  editDominant.value = r.winner !== 'draw' && r.dominant
  editNotes.value = r.notes
}

function cancelEdit() {
  editingIndex.value = null
}

function saveEdit(i: number) {
  emit('updateRecord', i, {
    winner: editWinner.value,
    dominant: editWinner.value !== 'draw' && editDominant.value,
    notes: editNotes.value.trim(),
  })
  editingIndex.value = null
}

function openImport() {
  importStatusState.value = { kind: 'none' }
  importInput.value?.click()
}

async function handleImportFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  try {
    const text = await file.text()
    const parsed = parseMatchData(text)
    if (parsed.length === 0) {
      importStatusState.value = { kind: 'no-records' }
      return
    }
    const imported: RecordedMatch[] = parsed.map((m) => ({
      left: m.left,
      right: m.right,
      winner: m.result,
      dominant: m.weight >= 1.5,
      notes: m.notes[0]?.text ?? '',
    }))
    emit('importRecords', imported)
    importStatusState.value = { kind: 'imported', count: imported.length }
  } catch (err) {
    importStatusState.value = { kind: 'failed', error: String(err) }
  } finally {
    if (importInput.value) importInput.value.value = ''
  }
}

const tabs = computed(() => [
  { id: 'popular-pick', label: i18n.t('wandwars.popular-pick') },
  { id: 'composite', label: joinLocale(i18n.t('wandwars.hero'), i18n.t('wandwars.synergy')) },
  { id: 'bradley-terry', label: i18n.t('wandwars.team-power') },
  { id: 'adaptive-ml', label: i18n.t('wandwars.adaptive-ml') },
  { id: 'records', label: i18n.t('wandwars.records') },
])

const activeTab = ref('popular-pick')

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
  activeTab.value = 'records'
}

const showCopiedFlash = ref(false)
const copyLabel = computed(() =>
  showCopiedFlash.value ? i18n.t('wandwars.copied') : i18n.t('wandwars.copy-data'),
)

async function handleCopy() {
  const content = serializeMatches(props.records)
  await navigator.clipboard.writeText(content)
  showCopiedFlash.value = true
  setTimeout(() => {
    showCopiedFlash.value = false
  }, 2000)
}

// Counter score threshold: > 0.1 = strong against, < -0.1 = weak against
const COUNTER_THRESHOLD = 0.1

/**
 * Check if adding this candidate to the current teammates forms a team
 * that has beaten teams containing the known opponents.
 * Works with 2+ known opponents (doesn't require all 3).
 */
function getTeamCounter(hero: string): TeamCounterInfo | null {
  const opponents = opponentTeam.value
  const teammates = currentTeammates.value
  if (opponents.length < 2 || teammates.length < 2) return null

  const myTeam = [...teammates, hero]
  const matches = getMatchData()

  let wins = 0
  let losses = 0
  let total = 0

  for (const match of matches) {
    const leftSet = new Set(match.left)
    const rightSet = new Set(match.right)

    // My team on left, opponents' heroes all on right (opponent may have unknown 3rd)
    const myOnLeft = myTeam.every((h) => leftSet.has(h)) && opponents.every((h) => rightSet.has(h))
    // My team on right, opponents' heroes all on left
    const myOnRight = myTeam.every((h) => rightSet.has(h)) && opponents.every((h) => leftSet.has(h))

    if (!myOnLeft && !myOnRight) continue

    total++
    if (myOnLeft && match.result === 'left') wins++
    else if (myOnLeft && match.result === 'right') losses++
    else if (myOnRight && match.result === 'right') wins++
    else if (myOnRight && match.result === 'left') losses++
  }

  if (total === 0) return null
  return { wins, losses, total }
}

function getCounterIndicators(hero: string): CounterIndicator[] {
  const analysis = getAnalysisData()
  const opponents = opponentTeam.value
  if (opponents.length === 0) return []

  const indicators: CounterIndicator[] = []
  for (const opp of opponents) {
    const score = analysis.counterMatrix[hero]?.[opp]?.score ?? 0
    if (score > COUNTER_THRESHOLD) {
      indicators.push({ opponent: opp, type: 'counters', score })
    } else if (score < -COUNTER_THRESHOLD) {
      indicators.push({ opponent: opp, type: 'countered', score })
    }
  }
  // Ordering: 'counters' (strong against) before 'countered' (weak against),
  // then by descending score magnitude within each group.
  return indicators.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'counters' ? -1 : 1
    return Math.abs(b.score) - Math.abs(a.score)
  })
}

const confidenceTooltipText = ref<string>('')
const confidenceTooltipTarget = ref<HTMLElement | null>(null)

function showConfidenceTooltip(
  scope: 'aggregate' | { modelId: string },
  level: 'high' | 'medium' | 'low',
  event: MouseEvent,
) {
  const keyPrefix = scope === 'aggregate' ? 'aggregate' : scope.modelId
  confidenceTooltipText.value = i18n.t(`wandwars.messages/confidence-${keyPrefix}-${level}`)
  confidenceTooltipTarget.value = event.currentTarget as HTMLElement
}

function hideConfidenceTooltip() {
  confidenceTooltipText.value = ''
  confidenceTooltipTarget.value = null
}

function recordVerbLabel(r: RecordedMatch): string {
  if (r.winner === 'draw') return i18n.t('wandwars.draw')
  return r.dominant ? i18n.t('wandwars.sweeps') : i18n.t('wandwars.beats')
}

function recordVerbKind(r: RecordedMatch): 'beats' | 'sweeps' | 'draw' {
  if (r.winner === 'draw') return 'draw'
  return r.dominant ? 'sweeps' : 'beats'
}

function recordVerbDirClass(r: RecordedMatch): string {
  if (r.winner === 'left') return 'dir-right'
  if (r.winner === 'right') return 'dir-left'
  return ''
}

const modelDescriptions = computed<Record<string, string>>(() => ({
  'popular-pick': i18n.t('wandwars.messages/tooltip-model-popular-pick'),
  composite: i18n.t('wandwars.messages/tooltip-model-composite'),
  'bradley-terry': i18n.t('wandwars.messages/tooltip-model-bradley-terry'),
  'adaptive-ml': i18n.t('wandwars.messages/tooltip-model-adaptive-ml'),
}))

function modelTabLabel(id: string): string {
  if (id === 'composite') return joinLocale(i18n.t('wandwars.hero'), i18n.t('wandwars.synergy'))
  const keys: Record<string, string> = {
    'popular-pick': 'wandwars.popular-pick',
    'bradley-terry': 'wandwars.team-power',
    'adaptive-ml': 'wandwars.adaptive-ml',
  }
  return keys[id] ? i18n.t(keys[id]!) : id
}

const tooltipModelId = ref<string | null>(null)
const tooltipTarget = ref<HTMLElement | null>(null)
const showRecordTooltip = ref(false)
const recordIconEl = ref<InstanceType<typeof IconInfo> | null>(null)
const recordTitleEl = computed(() => recordIconEl.value?.$el as HTMLElement | undefined)

function showModelTooltip(modelId: string, event: MouseEvent) {
  tooltipModelId.value = modelId
  tooltipTarget.value = event.currentTarget as HTMLElement
}

function hideModelTooltip() {
  tooltipModelId.value = null
  tooltipTarget.value = null
}

// Lock recommendations to a specific side (null = follow draft order)
const lockedSide = ref<PickSide | null>(null)

function toggleLock(side: PickSide) {
  lockedSide.value = lockedSide.value === side ? null : side
}

// The effective side used for recommendations (locked or auto-detected)
const effectivePickSide = computed<PickSide | null>(() => lockedSide.value ?? props.currentPickSide)

const effectivePickSideLabel = computed(() => {
  if (!effectivePickSide.value) return ''
  return effectivePickSide.value === 'left' ? i18n.t('wandwars.left') : i18n.t('wandwars.right')
})

const currentTeammates = computed(() => {
  if (!effectivePickSide.value) return []
  return props.pickState[effectivePickSide.value].filter((h): h is string => h !== null)
})

const opponentSide = computed<PickSide>(() =>
  effectivePickSide.value === 'left' ? 'right' : 'left',
)

const opponentTeam = computed(() => {
  if (!effectivePickSide.value) return []
  return props.pickState[opponentSide.value].filter((h): h is string => h !== null)
})

const allPickedHeroes = computed(() => [
  ...props.pickState.left.filter((h): h is string => h !== null),
  ...props.pickState.right.filter((h): h is string => h !== null),
])

const allPicked = computed(() => allPickedHeroes.value.length >= 6)

// When a pool filter is active, also mark every non-pool hero as "excluded"
// so Top Teams / Suggested Teams never suggest teams using heroes unavailable
// in the current match.
const topTeamsExcludeHeroes = computed(() => {
  if (!props.poolFilter) return allPickedHeroes.value
  const poolSet = new Set(props.poolFilter)
  const analysis = getAnalysisData()
  const outsidePool = analysis.allHeroes.filter((h) => !poolSet.has(h))
  return [...allPickedHeroes.value, ...outsidePool]
})

const recommendations = computed(() => {
  if (allPicked.value) return []
  const recs = getRecommendations(
    activeTab.value,
    currentTeammates.value,
    opponentTeam.value,
    allPickedHeroes.value,
  )
  if (!props.poolFilter) return recs
  const poolSet = new Set(props.poolFilter)
  return recs.filter((r) => poolSet.has(r.hero))
})

const recFactionFilter = ref('')
const recClassFilter = ref('')
const recDamageFilter = ref('')

const factionOptions = computed(() =>
  [...new Set(gameDataStore.characters.map((c) => c.faction))].sort(),
)
const classOptions = computed(() =>
  [...new Set(gameDataStore.characters.map((c) => c.class))].sort(),
)
const damageOptions = computed(() =>
  [...new Set(gameDataStore.characters.map((c) => c.damage))].sort(),
)

const characterMap = computed(() => {
  const map = new Map<string, (typeof gameDataStore.characters)[number]>()
  for (const c of gameDataStore.characters) map.set(c.name, c)
  return map
})

const filteredRecommendations = computed(() => {
  if (!recFactionFilter.value && !recClassFilter.value && !recDamageFilter.value) {
    return recommendations.value
  }
  return recommendations.value.filter((rec) => {
    const char = characterMap.value.get(rec.hero)
    if (!char) return false
    if (recFactionFilter.value && char.faction !== recFactionFilter.value) return false
    if (recClassFilter.value && char.class !== recClassFilter.value) return false
    if (recDamageFilter.value && char.damage !== recDamageFilter.value) return false
    return true
  })
})

interface SortOption {
  key: string
  label: string
}

const sortOptions = computed<SortOption[]>(() => {
  switch (activeTab.value) {
    case 'popular-pick':
      return [
        { key: 'score', label: i18n.t('wandwars.score') },
        { key: 'winRate', label: i18n.t('wandwars.win-rate') },
        { key: 'pickRate', label: i18n.t('wandwars.pick-rate') },
      ]
    case 'composite':
      return [
        { key: 'score', label: i18n.t('wandwars.score') },
        { key: 'base', label: i18n.t('wandwars.win-rate') },
        { key: 'synergy', label: i18n.t('wandwars.synergy') },
        { key: 'counter', label: i18n.t('wandwars.counter') },
        { key: 'pickRate', label: i18n.t('wandwars.pick-rate') },
      ]
    case 'bradley-terry':
      return [
        { key: 'score', label: i18n.t('wandwars.score') },
        { key: 'strength', label: i18n.t('wandwars.strength') },
        { key: 'winProbability', label: i18n.t('wandwars.win-prob') },
        { key: 'pickRate', label: i18n.t('wandwars.pick-rate') },
      ]
    case 'adaptive-ml':
      return [
        { key: 'score', label: i18n.t('wandwars.score') },
        { key: 'winProbability', label: i18n.t('wandwars.win-prob') },
        { key: 'pickRate', label: i18n.t('wandwars.pick-rate') },
      ]
    default:
      return [{ key: 'score', label: i18n.t('wandwars.score') }]
  }
})

const recSortKey = ref<string>('score')
const recSortDir = ref<'asc' | 'desc'>('desc')

function toggleRecSort(key: string) {
  if (recSortKey.value === key) {
    recSortDir.value = recSortDir.value === 'desc' ? 'asc' : 'desc'
  } else {
    recSortKey.value = key
    recSortDir.value = 'desc'
  }
}

watch(activeTab, () => {
  recSortKey.value = 'score'
  recSortDir.value = 'desc'
})

// When the 6th hero lands (draft just completed) and the user is sitting on
// the Records tab, switch to the default tab so the match prediction card
// is what they see. Only fires on the 5 → 6 transition so re-picks (e.g.
// removing and re-selecting a hero) don't repeatedly override the user's
// tab choice while the draft is already full.
const totalPicks = computed(
  () =>
    props.pickState.left.filter((h) => h !== null).length +
    props.pickState.right.filter((h) => h !== null).length,
)
watch(totalPicks, (newCount, oldCount) => {
  if (newCount === 6 && oldCount === 5 && activeTab.value === 'records') {
    activeTab.value = 'popular-pick'
  }
})

const sortedFilteredRecommendations = computed(() => {
  const sign = recSortDir.value === 'desc' ? 1 : -1
  const key = recSortKey.value
  return [...filteredRecommendations.value].sort((a, b) => {
    const av = key === 'score' ? a.score : ((a.breakdown[key] as number) ?? 0)
    const bv = key === 'score' ? b.score : ((b.breakdown[key] as number) ?? 0)
    return sign * (bv - av)
  })
})

const leftTeam = computed(() => props.pickState.left.filter((h): h is string => h !== null))

const rightTeam = computed(() => props.pickState.right.filter((h): h is string => h !== null))

const allPredictions = computed(() => {
  if (!allPicked.value) return []
  return getAllMatchupPredictions(leftTeam.value, rightTeam.value)
})

const aggregatePrediction = computed(() => {
  if (allPredictions.value.length === 0) return null
  return getAggregatePrediction(allPredictions.value)
})
</script>

<template>
  <div class="analysis ww-card">
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
        <div class="records-actions">
          <button class="export-btn" @click="handleCopy">
            {{ copyLabel }}
          </button>
          <button class="export-btn" @click="openImport">
            {{ i18n.t('wandwars.import-data') }}
          </button>
          <button class="export-btn" @click="emit('export')">
            {{ i18n.t('wandwars.export-data') }}
          </button>
          <button class="export-btn danger" @click="emit('clearRecords')">
            {{ i18n.t('wandwars.clear-all') }}
          </button>
        </div>
        <div v-if="importStatus" class="import-status">{{ importStatus }}</div>
        <div class="records-list">
          <div v-for="(record, i) in records" :key="i" class="record-entry">
            <div class="record-row">
              <div class="record-team">
                <img
                  v-for="hero in record.left"
                  :key="hero"
                  :src="characterImages[hero]"
                  :alt="hero"
                  :title="formatName(hero)"
                  class="record-portrait"
                />
              </div>
              <div v-if="editingIndex === i" class="record-edit-result">
                <button
                  :class="[
                    'edit-result-btn',
                    'left',
                    'dominant',
                    { active: editResultKey === 'left-dominant' },
                  ]"
                  title="Left Sweep"
                  @click="setEditResult('left', true)"
                >
                  <svg viewBox="0 0 16 16" class="result-icon" aria-hidden="true">
                    <path
                      d="M8 3L3 8l5 5M13 3L8 8l5 5"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </button>
                <button
                  :class="['edit-result-btn', 'left', { active: editResultKey === 'left-normal' }]"
                  title="Left Win"
                  @click="setEditResult('left', false)"
                >
                  <svg viewBox="0 0 16 16" class="result-icon" aria-hidden="true">
                    <path
                      d="M14 8H2M7 3L2 8l5 5"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </button>
                <button
                  :class="['edit-result-btn', 'draw', { active: editResultKey === 'draw' }]"
                  title="Draw"
                  @click="setEditResult('draw', false)"
                >
                  <svg viewBox="0 0 16 16" class="result-icon" aria-hidden="true">
                    <path
                      d="M3 6h10M3 10h10"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                    />
                  </svg>
                </button>
                <button
                  :class="[
                    'edit-result-btn',
                    'right',
                    { active: editResultKey === 'right-normal' },
                  ]"
                  title="Right Win"
                  @click="setEditResult('right', false)"
                >
                  <svg viewBox="0 0 16 16" class="result-icon" aria-hidden="true">
                    <path
                      d="M2 8h12M9 3l5 5-5 5"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </button>
                <button
                  :class="[
                    'edit-result-btn',
                    'right',
                    'dominant',
                    { active: editResultKey === 'right-dominant' },
                  ]"
                  title="Right Sweep"
                  @click="setEditResult('right', true)"
                >
                  <svg viewBox="0 0 16 16" class="result-icon" aria-hidden="true">
                    <path
                      d="M3 3l5 5-5 5M8 3l5 5-5 5"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </button>
              </div>
              <span
                v-else
                :class="[
                  'record-verb',
                  `kind-${recordVerbKind(record)}`,
                  recordVerbDirClass(record),
                ]"
              >
                <span>{{ recordVerbLabel(record) }}</span>
                <span
                  v-if="record.winner !== 'draw'"
                  :class="['record-arrow', { reverse: record.winner === 'right' }]"
                />
              </span>
              <div class="record-team">
                <img
                  v-for="hero in record.right"
                  :key="hero"
                  :src="characterImages[hero]"
                  :alt="hero"
                  :title="formatName(hero)"
                  class="record-portrait"
                />
              </div>
              <template v-if="editingIndex === i">
                <button class="edit-action-btn" title="Save" @click="saveEdit(i)">
                  <svg viewBox="0 0 16 16" class="row-icon" aria-hidden="true">
                    <path
                      d="M3 8l3 3 7-7"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </button>
                <button class="edit-action-btn cancel" title="Cancel" @click="cancelEdit">
                  <svg viewBox="0 0 16 16" class="row-icon" aria-hidden="true">
                    <path
                      d="M4 4l8 8M12 4l-8 8"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                    />
                  </svg>
                </button>
              </template>
              <template v-else>
                <button class="edit-btn" title="Edit" @click="startEdit(i)">
                  <svg viewBox="0 0 16 16" class="row-icon" aria-hidden="true">
                    <path
                      d="M11 2l3 3L5 14H2v-3L11 2zM10 3l3 3"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </button>
                <button class="delete-btn" title="Delete" @click="emit('deleteRecord', i)">
                  <svg viewBox="0 0 16 16" class="row-icon" aria-hidden="true">
                    <path
                      d="M4 4l8 8M12 4l-8 8"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                      stroke-linecap="round"
                    />
                  </svg>
                </button>
              </template>
            </div>
            <textarea
              v-if="editingIndex === i"
              v-model="editNotes"
              class="record-edit-notes"
              rows="2"
              :placeholder="i18n.t('wandwars.messages/notes-placeholder')"
            />
            <div
              v-else-if="record.notes"
              class="record-note"
              v-html="formatNoteHtml(record.notes, record.left, record.right)"
            />
          </div>
        </div>
      </div>

      <div v-else class="empty-state">
        {{ i18n.t('wandwars.messages/no-matches-yet') }}
        <div class="empty-state-actions">
          <button class="export-btn" @click="openImport">
            {{ i18n.t('wandwars.import-data') }}
          </button>
        </div>
      </div>

      <input
        ref="importInput"
        type="file"
        accept=".data,text/plain"
        class="hidden-import"
        @change="handleImportFile"
      />
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
      <div v-if="aggregatePrediction" class="matchup-section">
        <!-- Aggregate prediction -->
        <div class="matchup-prediction aggregate">
          <div class="matchup-header">
            <h3 class="matchup-title">{{ i18n.t('wandwars.matchup-prediction') }}</h3>
            <span
              :class="['confidence-badge', aggregatePrediction.confidence]"
              @mouseenter="
                showConfidenceTooltip('aggregate', aggregatePrediction.confidence, $event)
              "
              @mouseleave="hideConfidenceTooltip"
            >
              {{ i18n.t(`wandwars.${aggregatePrediction.confidence}-confidence`) }}
            </span>
          </div>
          <div class="matchup-bars">
            <div class="matchup-side left">
              <span class="matchup-label">{{ i18n.t('wandwars.left') }}</span>
              <span class="matchup-percent">{{
                formatPercent(aggregatePrediction.leftWinProbability)
              }}</span>
            </div>
            <div class="matchup-bar-track">
              <div
                class="matchup-bar-fill left"
                :style="{ width: formatPercent(aggregatePrediction.leftWinProbability) }"
              />
            </div>
            <div class="matchup-side right">
              <span class="matchup-percent">{{
                formatPercent(aggregatePrediction.rightWinProbability)
              }}</span>
              <span class="matchup-label">{{ i18n.t('wandwars.right') }}</span>
            </div>
          </div>
          <div class="matchup-verdict">
            <template v-if="aggregatePrediction.leftWinProbability > 0.55">
              <strong>{{ i18n.t('wandwars.left') }}</strong> {{ i18n.t('wandwars.team-favored') }}
            </template>
            <template v-else-if="aggregatePrediction.rightWinProbability > 0.55">
              <strong>{{ i18n.t('wandwars.right') }}</strong> {{ i18n.t('wandwars.team-favored') }}
            </template>
            <template v-else>{{ i18n.t('wandwars.messages/close-matchup') }}</template>
          </div>
          <div v-if="aggregatePrediction.relevantNotes.length > 0" class="matchup-notes">
            <div
              v-for="(note, i) in aggregatePrediction.relevantNotes.slice(0, 5)"
              :key="i"
              class="matchup-note"
              v-html="formatNoteHtml(note.text, leftTeam, rightTeam)"
            />
          </div>
          <div class="matchup-dataset-note">
            {{
              i18n
                .t('wandwars.messages/prediction-dataset')
                .replace('{matches}', String(aggregatePrediction.matchCount))
                .replace('{heroes}', String(aggregatePrediction.heroCount))
            }}
          </div>
        </div>

        <!-- Individual model predictions -->
        <div v-for="pred in allPredictions" :key="pred.id" class="matchup-prediction">
          <div class="matchup-header">
            <h3 class="matchup-title">
              {{ modelTabLabel(pred.id) }}
            </h3>
            <IconInfo
              class="model-info-icon"
              :size="14"
              @mouseenter="showModelTooltip(pred.id, $event)"
              @mouseleave="hideModelTooltip"
            />
            <span
              :class="['confidence-badge', pred.prediction.confidence]"
              @mouseenter="
                showConfidenceTooltip({ modelId: pred.id }, pred.prediction.confidence, $event)
              "
              @mouseleave="hideConfidenceTooltip"
            >
              {{ i18n.t(`wandwars.${pred.prediction.confidence}-confidence`) }}
            </span>
          </div>
          <div class="matchup-bars">
            <div class="matchup-side left">
              <span class="matchup-label">{{ i18n.t('wandwars.left') }}</span>
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
              <span class="matchup-label">{{ i18n.t('wandwars.right') }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Quick record form -->
      <div v-if="aggregatePrediction" class="record-form">
        <h4 class="record-form-title">
          {{ i18n.t('wandwars.record-match') }}
          <IconInfo
            ref="recordIconEl"
            :size="14"
            class="record-info-icon"
            @mouseenter="showRecordTooltip = true"
            @mouseleave="showRecordTooltip = false"
          />
        </h4>
        <div class="result-buttons">
          <button
            :class="['result-btn', 'left', 'dominant', { active: resultKey === 'left-dominant' }]"
            @click="setResult('left', true)"
          >
            {{ i18n.t('wandwars.left-win-sweep') }}
          </button>
          <button
            :class="['result-btn', 'left', { active: resultKey === 'left-normal' }]"
            @click="setResult('left', false)"
          >
            {{ i18n.t('wandwars.left-win') }}
          </button>
          <button
            :class="['result-btn', 'draw', { active: resultKey === 'draw' }]"
            @click="setResult('draw', false)"
          >
            {{ i18n.t('wandwars.draw') }}
          </button>
          <button
            :class="['result-btn', 'right', { active: resultKey === 'right-normal' }]"
            @click="setResult('right', false)"
          >
            {{ i18n.t('wandwars.right-win') }}
          </button>
          <button
            :class="['result-btn', 'right', 'dominant', { active: resultKey === 'right-dominant' }]"
            @click="setResult('right', true)"
          >
            {{ i18n.t('wandwars.right-win-sweep') }}
          </button>
        </div>
        <textarea
          v-model="recordNotes"
          class="notes-input"
          rows="2"
          :placeholder="i18n.t('wandwars.messages/notes-placeholder')"
        />
        <button class="submit-btn" @click="handleRecordSubmit">
          {{ i18n.t('wandwars.save-result') }}
        </button>
        <p class="record-tip">{{ i18n.t('wandwars.messages/reset-after-save') }}</p>
      </div>

      <!-- Recommendations while drafting -->
      <template v-else>
        <div class="recommend-header">
          <div :class="['picking-indicator', effectivePickSide]">
            {{ i18n.t('wandwars.recommending-for') }} <strong>{{ effectivePickSideLabel }}</strong>
          </div>
          <div class="lock-toggle">
            <button
              :class="['lock-btn', { active: lockedSide === 'left' }]"
              @click="toggleLock('left')"
              title="Lock recommendations to Left team"
            >
              <svg
                v-if="lockedSide === 'left'"
                class="lock-icon"
                viewBox="0 0 16 16"
                fill="currentColor"
              >
                <path
                  d="M12 7h-1V5a3 3 0 0 0-6 0v2H4a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1zM7 5a1 1 0 0 1 2 0v2H7V5z"
                />
              </svg>
              {{ joinLocale(i18n.t('wandwars.left'), i18n.t('wandwars.team')) }}
            </button>
            <button
              :class="['lock-btn', { active: lockedSide === 'right' }]"
              @click="toggleLock('right')"
              :title="joinLocale(i18n.t('wandwars.right'), i18n.t('wandwars.team'))"
            >
              <svg
                v-if="lockedSide === 'right'"
                class="lock-icon"
                viewBox="0 0 16 16"
                fill="currentColor"
              >
                <path
                  d="M12 7h-1V5a3 3 0 0 0-6 0v2H4a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1zM7 5a1 1 0 0 1 2 0v2H7V5z"
                />
              </svg>
              {{ joinLocale(i18n.t('wandwars.right'), i18n.t('wandwars.team')) }}
            </button>
          </div>
        </div>

        <WandWarsTopTeams
          v-if="currentTeammates.length > 0"
          :teammates="currentTeammates"
          :exclude-heroes="topTeamsExcludeHeroes"
          :matches="matchData"
          :character-images="characterImages"
        />

        <div v-if="recommendations.length > 0" class="filters-row">
          <FilterIcons
            v-model="recFactionFilter"
            icon-prefix="faction"
            :options="factionOptions"
            :size="32"
            :show-tooltip="false"
            active-border-color="var(--color-primary)"
          />
          <FilterIcons
            v-model="recClassFilter"
            icon-prefix="class"
            :options="classOptions"
            :size="32"
            :show-tooltip="false"
            active-border-color="var(--color-primary)"
          />
          <FilterIcons
            v-model="recDamageFilter"
            icon-prefix="damage"
            :options="damageOptions"
            :size="32"
            :show-tooltip="false"
            active-border-color="var(--color-primary)"
          />
        </div>

        <div v-if="recommendations.length === 0" class="empty-state">
          {{ i18n.t('wandwars.messages/pick-heroes-prompt') }}
        </div>

        <div v-else-if="filteredRecommendations.length === 0" class="empty-state">
          {{ i18n.t('wandwars.messages/no-recommendations') }}
        </div>

        <template v-else>
          <div class="rec-sort-row">
            <span class="rec-sort-label">{{ i18n.t('wandwars.sort-by') }}</span>
            <button
              v-for="opt in sortOptions"
              :key="opt.key"
              :class="['rec-sort-btn', { active: recSortKey === opt.key }]"
              @click="toggleRecSort(opt.key)"
            >
              {{ opt.label
              }}<span v-if="recSortKey === opt.key" class="sort-arrow">{{
                recSortDir === 'desc' ? '▼' : '▲'
              }}</span>
            </button>
          </div>

          <div class="recommendations">
            <WandWarsRecommendation
              v-for="rec in sortedFilteredRecommendations"
              :key="rec.hero"
              :recommendation="rec"
              :model-id="activeTab"
              :character-images="characterImages"
              :counter-indicators="getCounterIndicators(rec.hero)"
              :team-counter="getTeamCounter(rec.hero)"
              :opponent-count="opponentTeam.length"
              :left-team="leftTeam"
              :right-team="rightTeam"
              :sort-key="recSortKey"
            />
          </div>
        </template>
      </template>
    </div>

    <Teleport to="body">
      <TooltipPopup
        v-if="tooltipModelId && tooltipTarget"
        :target-element="tooltipTarget"
        variant="detailed"
        :text="modelDescriptions[tooltipModelId]"
        :max-width="'260px'"
      />
      <TooltipPopup
        v-if="showRecordTooltip && recordTitleEl"
        :target-element="recordTitleEl"
        variant="detailed"
        :text="i18n.t('wandwars.messages/tooltip-sweep')"
        max-width="260px"
      />
      <TooltipPopup
        v-if="confidenceTooltipText && confidenceTooltipTarget"
        :target-element="confidenceTooltipTarget"
        variant="detailed"
        max-width="300px"
      >
        <template #content>
          <div class="confidence-tooltip">{{ confidenceTooltipText }}</div>
        </template>
      </TooltipPopup>
    </Teleport>
  </div>
</template>

<style scoped>
.filters-row {
  display: flex;
  gap: var(--spacing-md);
  align-items: end;
  flex-wrap: wrap;
}

.rec-sort-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  flex-wrap: wrap;
  margin: var(--spacing-lg) 0 var(--spacing-sm);
  padding: 0 0 var(--spacing-xs) var(--spacing-sm);
  border-bottom: 1px solid var(--color-border-light);
}

.rec-sort-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-right: var(--spacing-xs);
}

.rec-sort-btn {
  padding: 2px var(--spacing-sm);
  border: none;
  background: none;
  color: var(--color-text-secondary);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  border-radius: var(--radius-small);
  transition: color var(--transition-fast);
}

.rec-sort-btn:hover:not(.active) {
  color: var(--color-text-primary);
}

.rec-sort-btn.active {
  color: var(--color-primary);
}

.rec-sort-btn .sort-arrow {
  display: inline-block;
  margin-left: 3px;
  font-size: 0.7em;
}

/* Flex layout for pinned tabs + scrollable tab-content.
   Card chrome comes from the shared .ww-card class (base.css). */
.analysis {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.tab-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

/* Match-prediction view should flow naturally — matchup cards + record
   form stay fully visible, no inner scrollbar. Paired with the column
   max-height release in WandWarsView.vue via :has(.matchup-section). */
.analysis:has(.matchup-section) {
  overflow: visible;
}

.analysis:has(.matchup-section) .tab-content {
  overflow-y: visible;
}

.tabs {
  display: flex;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-md);
  border-bottom: 2px solid var(--color-border-light);
}

.tab-btn {
  padding: var(--spacing-sm) var(--spacing-md);
  border: none;
  background: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  font-size: 0.9rem;
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

.recommend-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-sm);
}

.recommend-header .picking-indicator {
  margin-bottom: 0;
}

.lock-toggle {
  display: flex;
  gap: 2px;
  margin-right: var(--spacing-sm);
}

.lock-btn {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-small);
  background: var(--color-bg-white);
  color: var(--color-text-secondary);
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 600;
  transition:
    background var(--transition-fast),
    color var(--transition-fast);
}

.lock-btn:hover:not(.active) {
  background: var(--color-bg-secondary);
}

.lock-btn.active {
  background: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}

.lock-icon {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
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
  background: var(--color-warning-bg);
  border: 1px solid var(--color-warning);
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
  margin-top: var(--spacing-sm);
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
  padding: var(--spacing-sm);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-medium);
  background: var(--color-bg-white);
}

.matchup-prediction.aggregate {
  padding: var(--spacing-md);
  background: var(--color-bg-tertiary);
}

.model-info-icon {
  width: 14px;
  height: 14px;
  color: var(--color-text-secondary);
  cursor: help;
  flex-shrink: 0;
  opacity: 0.5;
  transition: opacity var(--transition-fast);
}

.model-info-icon:hover {
  opacity: 1;
}

.matchup-dataset-note {
  margin-top: var(--spacing-sm);
  padding-top: var(--spacing-sm);
  border-top: 1px solid var(--color-border-light);
  font-size: 0.75rem;
  color: var(--color-text-secondary);
  text-align: center;
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
  cursor: help;
}

.confidence-tooltip {
  line-height: 1.4;
  font-size: 0.85rem;
}

.confidence-badge.high {
  background: var(--color-success-bg);
  color: var(--color-success);
}

.confidence-badge.medium {
  background: var(--color-warning-bg);
  color: var(--color-warning);
}

.confidence-badge.low {
  background: var(--color-error-bg);
  color: var(--color-error);
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
  line-height: 1.4;
}

.matchup-note :deep(.hero-highlight) {
  font-style: normal;
}

.matchup-note :deep(.hero-highlight.team-left) {
  color: var(--color-ally);
}

.matchup-note :deep(.hero-highlight.team-right) {
  color: var(--color-enemy);
}

/* Quick record form */
.record-form {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-md);
  padding: var(--spacing-md);
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-medium);
  background: var(--color-bg-white);
}

.record-form-title {
  margin: 0;
  font-size: 1rem;
  color: var(--color-text-primary);
  text-align: center;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-xs);
}

.record-info-icon {
  color: var(--color-text-secondary);
  cursor: help;
  opacity: 0.5;
  transition: opacity var(--transition-fast);
}

.record-info-icon:hover {
  opacity: 1;
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

.record-tip {
  margin: 0;
  font-size: 0.75rem;
  color: var(--color-text-light);
  text-align: center;
}

/* Records list — action buttons + import status stay pinned at the top,
   only the list itself scrolls. Moves the overflow boundary from
   .tab-content to .records-list when the records tab is active. */
.tab-content:has(.records-section) {
  overflow-y: hidden;
  display: flex;
  flex-direction: column;
}

.records-section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  flex: 1;
  min-height: 0;
}

.records-actions,
.import-status {
  flex-shrink: 0;
}

.records-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}

.record-entry {
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-medium);
  padding: var(--spacing-sm);
  background: var(--color-bg-white);
  transition: box-shadow var(--transition-fast);
}

.record-entry:hover {
  box-shadow: var(--shadow-small);
}

.record-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  font-size: 0.85rem;
  flex-wrap: wrap;
}

.record-team {
  display: flex;
  gap: 4px;
  flex: 1;
  min-width: 0;
}

.record-team:last-of-type {
  justify-content: flex-end;
}

.record-portrait {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
  object-position: center 20%;
  border: 1px solid var(--color-border-light);
  flex-shrink: 0;
}

.record-verb {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  margin: 0 var(--spacing-sm);
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  line-height: 1.1;
  white-space: nowrap;
}

.record-verb.kind-sweeps {
  color: var(--color-error);
  font-weight: 700;
}

/* Nudge only the arrow so the arrowhead's extra visual weight on one side
   doesn't feel off-center. Text labels stay on a common baseline across rows. */
.record-verb.dir-right .record-arrow {
  transform: translateX(-5px);
}

.record-verb.dir-left .record-arrow {
  transform: translateX(5px);
}

.record-arrow {
  display: flex;
  align-items: center;
  /* Balance the triangle on the right with empty space on the left so the
     bar's midpoint lines up with the verb label above it. */
  padding-left: 10px;
}

.record-arrow::before {
  content: '';
  display: block;
  width: 56px;
  height: 4px;
  background: var(--color-primary);
}

.record-arrow::after {
  content: '';
  display: block;
  width: 0;
  height: 0;
  border-top: 8px solid transparent;
  border-bottom: 8px solid transparent;
  border-left: 10px solid var(--color-primary);
}

.record-arrow.reverse {
  flex-direction: row-reverse;
  padding-left: 0;
  padding-right: 10px;
}

.record-arrow.reverse::after {
  border-left: none;
  border-right: 10px solid var(--color-primary);
}

.record-verb.kind-sweeps .record-arrow::before {
  background: var(--color-error);
}

.record-verb.kind-sweeps .record-arrow:not(.reverse)::after {
  border-left-color: var(--color-error);
}

.record-verb.kind-sweeps .record-arrow.reverse::after {
  border-right-color: var(--color-error);
}

.record-note {
  margin-top: var(--spacing-xs);
  padding-top: var(--spacing-xs);
  border-top: 1px solid var(--color-border-light);
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  line-height: 1.4;
}

.record-note :deep(.hero-highlight) {
  font-style: normal;
}

.record-note :deep(.hero-highlight.team-left) {
  color: var(--color-ally);
}

.record-note :deep(.hero-highlight.team-right) {
  color: var(--color-enemy);
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

.edit-btn {
  background: none;
  border: none;
  color: var(--color-text-secondary);
  cursor: pointer;
  font-size: 0.85rem;
  padding: 2px 4px;
  border-radius: var(--radius-small);
  transition:
    background var(--transition-fast),
    color var(--transition-fast);
}

.edit-btn:hover {
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
}

.edit-action-btn {
  background: none;
  border: 1px solid var(--color-border-primary);
  color: var(--color-primary);
  cursor: pointer;
  font-size: 0.85rem;
  padding: 2px 8px;
  border-radius: var(--radius-small);
  transition:
    background var(--transition-fast),
    color var(--transition-fast);
}

.edit-action-btn:hover {
  background: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}

.edit-action-btn.cancel {
  color: var(--color-text-secondary);
}

.edit-action-btn.cancel:hover {
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
  border-color: var(--color-border-primary);
}

.record-edit-result {
  display: flex;
  gap: 2px;
  margin: 0 var(--spacing-sm);
}

.edit-result-btn {
  padding: 4px;
  border: 1px solid var(--color-border-primary);
  background: var(--color-bg-white);
  color: var(--color-text-secondary);
  cursor: pointer;
  border-radius: var(--radius-small);
  width: 30px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.result-icon {
  width: 16px;
  height: 16px;
}

.row-icon {
  width: 14px;
  height: 14px;
  display: block;
}

.edit-result-btn:hover:not(.active) {
  background: var(--color-bg-secondary);
}

.edit-result-btn.left.active,
.edit-result-btn.right.active {
  background: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}

.edit-result-btn.left.dominant.active,
.edit-result-btn.right.dominant.active {
  background: var(--color-error);
  color: white;
  border-color: var(--color-error);
}

.edit-result-btn.draw.active {
  background: var(--color-text-secondary);
  color: white;
  border-color: var(--color-text-secondary);
}

.record-edit-notes {
  margin-top: var(--spacing-xs);
  width: 100%;
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--color-border-primary);
  border-radius: var(--radius-small);
  font-family: inherit;
  font-size: 0.85rem;
  resize: vertical;
  box-sizing: border-box;
}

.records-actions {
  display: flex;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-sm);
  flex-wrap: wrap;
}

.import-status {
  margin-top: var(--spacing-xs);
  font-size: 0.8rem;
  color: var(--color-text-secondary);
}

.hidden-import {
  display: none;
}

.empty-state-actions {
  margin-top: var(--spacing-md);
  display: flex;
  justify-content: center;
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

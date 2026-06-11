<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import WandWarsMatchupPrediction from './WandWarsMatchupPrediction.vue'
import WandWarsRecommendation from './WandWarsRecommendation.vue'
import WandWarsRecordForm from './WandWarsRecordForm.vue'
import WandWarsRecordsList from './WandWarsRecordsList.vue'
import WandWarsTopTeams from './WandWarsTopTeams.vue'
import FilterIcons from '@/components/ui/FilterIcons.vue'
import { useGameDataStore } from '@/stores/gameData'
import { useI18nStore } from '@/stores/i18n'
import { BT_LOW_DATA_THRESHOLD } from '@/wandwars/constants'
import { joinLocale } from '@/wandwars/formatting'
import {
  getAggregatePrediction,
  getAllMatchupPredictions,
  getAnalysisData,
  getMatchData,
  getRecommendations,
} from '@/wandwars/prediction/recommend'
import { buildCounterIndicatorMap, buildTeamCounterMap } from '@/wandwars/teamCounter'
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
  updateRecord: [index: number, changes: Partial<RecordedMatch>]
}>()

const tabs = computed(() => [
  { id: 'popular-pick', label: i18n.t('wandwars.popular-pick') },
  { id: 'composite', label: joinLocale(i18n.t('wandwars.hero'), i18n.t('wandwars.synergy')) },
  { id: 'bradley-terry', label: i18n.t('wandwars.team-power') },
  { id: 'adaptive-ml', label: i18n.t('wandwars.adaptive-ml') },
  { id: 'records', label: i18n.t('wandwars.records') },
])

const activeTab = ref('popular-pick')

function onRecordSubmit(record: RecordedMatch) {
  emit('recordMatch', record)
  activeTab.value = 'records'
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

// Per-card counter data, keyed by candidate hero. Computed so the single-pass
// scans refresh on draft changes — not on sort/filter re-renders, which a
// per-card template method call would.
const teamCounterByHero = computed(() =>
  buildTeamCounterMap(getMatchData(), currentTeammates.value, opponentTeam.value),
)

const counterIndicatorsByHero = computed(() =>
  buildCounterIndicatorMap(getAnalysisData().counterMatrix, opponentTeam.value),
)

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
    <WandWarsRecordsList
      v-if="activeTab === 'records'"
      :records="records"
      :character-images="characterImages"
      class="tab-content"
      @delete-record="(i) => emit('deleteRecord', i)"
      @clear-records="emit('clearRecords')"
      @export="emit('export')"
      @import-records="(r) => emit('importRecords', r)"
      @update-record="(i, changes) => emit('updateRecord', i, changes)"
    />

    <!-- Model tabs -->
    <div v-else class="tab-content">
      <div
        v-if="activeTab === 'bradley-terry' && matchData.length < BT_LOW_DATA_THRESHOLD"
        class="warning-banner"
      >
        {{ i18n.t('wandwars.messages/low-data-warning', { count: matchData.length }) }}
      </div>

      <WandWarsMatchupPrediction
        :aggregate-prediction="aggregatePrediction"
        :all-predictions="allPredictions"
        :left-team="leftTeam"
        :right-team="rightTeam"
      />

      <WandWarsRecordForm
        v-if="aggregatePrediction"
        :pick-state="pickState"
        @submit="onRecordSubmit"
      />

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
              :title="i18n.t('wandwars.messages/lock-to-team', { side: i18n.t('wandwars.left') })"
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
              :title="i18n.t('wandwars.messages/lock-to-team', { side: i18n.t('wandwars.right') })"
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
              :counter-indicators="counterIndicatorsByHero.get(rec.hero) ?? []"
              :team-counter="teamCounterByHero.get(rec.hero) ?? null"
              :opponent-count="opponentTeam.length"
              :left-team="leftTeam"
              :right-team="rightTeam"
              :sort-key="recSortKey"
            />
          </div>
        </template>
      </template>
    </div>
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
  flex: 0 0 auto;
  white-space: nowrap;
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

@media (max-width: 768px) {
  .tabs {
    overflow-x: auto;
    overflow-y: hidden;
  }

  .tab-btn {
    padding: var(--spacing-sm);
    font-size: 0.85rem;
  }
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
</style>

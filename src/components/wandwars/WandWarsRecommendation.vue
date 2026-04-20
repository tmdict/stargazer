<template>
  <div :class="['recommendation-card', recommendation.confidence]">
    <div class="card-header">
      <img
        v-if="characterImages[recommendation.hero]"
        :src="characterImages[recommendation.hero]"
        :alt="recommendation.hero"
        class="hero-portrait"
      />
      <div class="hero-info">
        <span class="hero-name">{{ formatName(recommendation.hero) }}</span>
      </div>
      <div class="score-confidence">
        <span :class="['confidence-badge', recommendation.confidence]" :title="confidenceTooltip">
          {{ i18n.t(`wandwars.${dataDepthLabel}`) }}
        </span>
        <span class="score"
          ><span class="score-label">{{ i18n.t('wandwars.score') }}:</span>
          {{ formatScore(recommendation.score) }}</span
        >
      </div>
    </div>

    <div class="breakdown">
      <template v-if="modelId === 'popular-pick'">
        <div :class="['breakdown-row', { 'sort-active': sortKey === 'winRate' }]">
          <span class="breakdown-label">{{ i18n.t('wandwars.win-rate') }}</span>
          <span class="breakdown-value">
            {{ formatPercent(recommendation.breakdown.winRate as number) }}
          </span>
        </div>
        <div :class="['breakdown-row', { 'sort-active': sortKey === 'pickRate' }]">
          <span class="breakdown-label">{{ i18n.t('wandwars.pick-rate') }}</span>
          <span class="breakdown-value">{{
            formatPercent(recommendation.breakdown.pickRate as number)
          }}</span>
        </div>
        <div
          v-for="pair in (recommendation.breakdown.pairDetails as {
            teammate: string
            wins: number
            total: number
          }[]) || []"
          :key="pair.teammate"
          class="breakdown-row"
        >
          <span class="breakdown-label">w/ {{ formatName(pair.teammate) }}</span>
          <span class="breakdown-value">
            <span class="pair-wins">{{ pair.wins }}W</span> /
            <span class="pair-losses">{{ pair.total - pair.wins }}L</span>
          </span>
        </div>
      </template>
      <template v-else-if="modelId === 'composite'">
        <div :class="['breakdown-row', { 'sort-active': sortKey === 'base' }]">
          <span class="breakdown-label">{{ i18n.t('wandwars.win-rate') }}</span>
          <span class="breakdown-value">{{
            formatPercent(recommendation.breakdown.base as number)
          }}</span>
        </div>
        <div :class="['breakdown-row', { 'sort-active': sortKey === 'synergy' }]">
          <span class="breakdown-label">{{ i18n.t('wandwars.synergy') }}</span>
          <span :class="['breakdown-value', signClass(recommendation.breakdown.synergy as number)]">
            {{ formatSigned(recommendation.breakdown.synergy as number) }}
          </span>
        </div>
        <div :class="['breakdown-row', { 'sort-active': sortKey === 'counter' }]">
          <span class="breakdown-label">{{ i18n.t('wandwars.counter') }}</span>
          <span :class="['breakdown-value', signClass(recommendation.breakdown.counter as number)]">
            {{ formatSigned(recommendation.breakdown.counter as number) }}
          </span>
        </div>
        <div v-if="(recommendation.breakdown.trio as number) !== 0" class="breakdown-row">
          <span class="breakdown-label">{{ i18n.t('wandwars.trio') }}</span>
          <span :class="['breakdown-value', signClass(recommendation.breakdown.trio as number)]">
            {{ formatSigned(recommendation.breakdown.trio as number) }}
          </span>
        </div>
        <div :class="['breakdown-row', { 'sort-active': sortKey === 'pickRate' }]">
          <span class="breakdown-label">{{ i18n.t('wandwars.pick-rate') }}</span>
          <span class="breakdown-value">{{
            formatPercent(recommendation.breakdown.pickRate as number)
          }}</span>
        </div>
      </template>
      <template v-else-if="modelId === 'bradley-terry'">
        <div :class="['breakdown-row', { 'sort-active': sortKey === 'strength' }]">
          <span class="breakdown-label">{{ i18n.t('wandwars.strength') }}</span>
          <span class="breakdown-value">{{
            (recommendation.breakdown.strength as number)?.toFixed(2)
          }}</span>
        </div>
        <div :class="['breakdown-row', { 'sort-active': sortKey === 'winProbability' }]">
          <span class="breakdown-label">{{ i18n.t('wandwars.win-prob') }}</span>
          <span class="breakdown-value">{{
            formatPercent(recommendation.breakdown.winProbability as number)
          }}</span>
        </div>
        <div v-if="(recommendation.breakdown.pairSynergy as number) !== 0" class="breakdown-row">
          <span class="breakdown-label">{{ i18n.t('wandwars.pair-synergy') }}</span>
          <span class="breakdown-value">{{
            formatSigned(recommendation.breakdown.pairSynergy as number)
          }}</span>
        </div>
        <div :class="['breakdown-row', { 'sort-active': sortKey === 'pickRate' }]">
          <span class="breakdown-label">{{ i18n.t('wandwars.pick-rate') }}</span>
          <span class="breakdown-value">{{
            formatPercent(recommendation.breakdown.pickRate as number)
          }}</span>
        </div>
      </template>
      <template v-else-if="modelId === 'adaptive-ml'">
        <div :class="['breakdown-row', { 'sort-active': sortKey === 'winProbability' }]">
          <span class="breakdown-label">{{ i18n.t('wandwars.win-prob') }}</span>
          <span class="breakdown-value">{{
            formatPercent(recommendation.breakdown.winProbability as number)
          }}</span>
        </div>
        <div :class="['breakdown-row', { 'sort-active': sortKey === 'pickRate' }]">
          <span class="breakdown-label">{{ i18n.t('wandwars.pick-rate') }}</span>
          <span class="breakdown-value">{{
            formatPercent(recommendation.breakdown.pickRate as number)
          }}</span>
        </div>
      </template>
    </div>

    <div
      v-if="
        (counterIndicators && counterIndicators.length > 0) ||
        (teamCounter && teamCounter.wins > teamCounter.losses)
      "
      class="counter-indicators"
    >
      <span
        v-if="teamCounter && teamCounter.wins > teamCounter.losses"
        class="counter-tag team-counter"
      >
        <svg class="counter-icon" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 0l2.5 5.3L16 6.2l-4 3.8 1 5.5L8 12.8l-5 2.7 1-5.5L0 6.2l5.5-.9L8 0z" />
        </svg>
        <span class="counter-text">
          {{
            opponentCount !== undefined && opponentCount >= 3
              ? joinLocale(i18n.t('wandwars.team'), i18n.t('wandwars.counter'))
              : i18n.t('wandwars.potential-team-counter')
          }}
          <span class="pair-wins">{{ teamCounter.wins }}W</span> /
          <span class="pair-losses">{{ teamCounter.losses }}L</span>
        </span>
      </span>
      <span v-for="ci in counterIndicators" :key="ci.opponent" :class="['counter-tag', ci.type]">
        <svg
          v-if="ci.type === 'counters'"
          class="counter-icon"
          viewBox="0 0 16 16"
          fill="currentColor"
        >
          <path
            d="M8 1L2 5v4c0 3.3 2.6 6.4 6 7 3.4-.6 6-3.7 6-7V5L8 1zm0 2.2L12 6v3c0 2.5-1.8 4.8-4 5.4V3.2z"
          />
        </svg>
        <svg v-else class="counter-icon" viewBox="0 0 16 16" fill="currentColor">
          <path
            d="M8 1L1 14h14L8 1zm0 3.5L12.5 13h-9L8 4.5zM7.25 7v3h1.5V7h-1.5zm0 4v1.5h1.5V11h-1.5z"
          />
        </svg>
        <span class="counter-text">
          {{
            ci.type === 'counters'
              ? i18n.t('wandwars.strong-against')
              : i18n.t('wandwars.weak-against')
          }}
          {{ formatName(ci.opponent) }}
        </span>
      </span>
    </div>

    <div v-if="recommendation.relevantNotes.length > 0" class="notes">
      <div
        v-for="(note, i) in recommendation.relevantNotes.slice(0, 2)"
        :key="i"
        class="note"
        v-html="formatNoteHtml(note.text, props.leftTeam ?? [], props.rightTeam ?? [])"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18nStore } from '@/stores/i18n'
import { DATA_DEPTH_DESCRIPTIONS } from '@/wandwars/constants'
import {
  formatName,
  formatNoteHtml,
  formatPercent,
  formatScore,
  formatSigned,
  joinLocale,
  signClass,
} from '@/wandwars/formatting'
import type { Recommendation } from '@/wandwars/types'

export interface CounterIndicator {
  opponent: string
  type: 'counters' | 'countered'
  score: number
}

export interface TeamCounterInfo {
  wins: number
  losses: number
  total: number
}

const props = defineProps<{
  recommendation: Recommendation
  modelId: string
  characterImages: Record<string, string>
  counterIndicators?: CounterIndicator[]
  teamCounter?: TeamCounterInfo | null
  opponentCount?: number
  leftTeam?: string[]
  rightTeam?: string[]
  sortKey?: string
}>()

const i18n = useI18nStore()
const confidenceTooltip = DATA_DEPTH_DESCRIPTIONS[props.recommendation.confidence]
const DATA_DEPTH_LABEL_KEYS: Record<string, string> = {
  high: 'rich-data',
  medium: 'moderate-data',
  low: 'sparse-data',
}
const dataDepthLabel = DATA_DEPTH_LABEL_KEYS[props.recommendation.confidence] ?? 'sparse-data'
</script>

<style scoped>
.recommendation-card {
  border: 1px solid var(--color-border-light);
  border-radius: var(--radius-medium);
  padding: var(--spacing-sm);
  background: var(--color-bg-white);
  transition: box-shadow var(--transition-fast);
}

.recommendation-card:hover {
  box-shadow: var(--shadow-small);
}

.card-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.hero-portrait {
  width: 48px;
  height: 48px;
  border-radius: var(--radius-round);
  object-fit: cover;
  object-position: center 20%;
}

.hero-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.hero-name {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--color-text-primary);
}

.score-confidence {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.score {
  font-size: 0.9rem;
  color: var(--color-primary);
  font-weight: 700;
}

.score-label {
  color: var(--color-text-secondary);
  font-weight: 600;
}

.confidence-badge {
  font-size: 0.6rem;
  padding: 3px 8px;
  border-radius: var(--radius-small);
  text-transform: uppercase;
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

.breakdown {
  display: flex;
  gap: var(--spacing-md);
  margin-top: var(--spacing-xs);
  padding-top: var(--spacing-xs);
  border-top: 1px solid var(--color-border-light);
}

.breakdown-row {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.breakdown-label {
  font-size: 0.75rem;
  color: var(--color-text-secondary);
  text-transform: uppercase;
}

.breakdown-row.sort-active .breakdown-label {
  color: var(--color-primary);
  font-weight: 700;
}

.breakdown-value {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-primary);
}

.breakdown-value.positive {
  color: var(--color-success);
}

.breakdown-value.negative {
  color: var(--color-error);
}

.notes {
  margin-top: var(--spacing-xs);
  padding-top: var(--spacing-xs);
  border-top: 1px solid var(--color-border-light);
}

.note {
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  line-height: 1.4;
}

.pair-wins {
  color: var(--color-success);
}

.pair-losses {
  color: var(--color-error);
}

.counter-indicators {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
  margin-top: var(--spacing-xs);
  padding-top: var(--spacing-xs);
  border-top: 1px solid var(--color-border-light);
}

.counter-tag {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 8px;
  border-radius: var(--radius-small);
  font-size: 0.7rem;
  font-weight: 600;
}

.counter-tag.counters {
  background: var(--color-success-bg);
  color: var(--color-success);
}

.counter-tag.countered {
  background: var(--color-error-bg);
  color: var(--color-error);
}

.counter-tag.team-counter {
  background: #fef3cd;
  color: #856404;
}

.counter-icon {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
}

.counter-text {
  white-space: nowrap;
}

.context-hint {
  font-size: 0.7rem;
  color: var(--color-text-secondary);
  font-weight: 400;
}

.note :deep(.hero-highlight) {
  font-style: normal;
}

.note :deep(.hero-highlight.team-left) {
  color: var(--color-ally);
}

.note :deep(.hero-highlight.team-right) {
  color: var(--color-enemy);
}
</style>

<template>
  <div :class="['recommendation-card', recommendation.confidence]">
    <div class="card-header">
      <span class="rank">{{ rank }}</span>
      <img
        v-if="characterImages[recommendation.hero]"
        :src="characterImages[recommendation.hero]"
        :alt="recommendation.hero"
        class="hero-portrait"
      />
      <div class="hero-info">
        <span class="hero-name">{{ formatName(recommendation.hero) }}</span>
        <span class="score">{{ formatScore(recommendation.score) }}</span>
      </div>
      <span :class="['confidence-badge', recommendation.confidence]" :title="confidenceTooltip">
        {{ recommendation.confidence }} confidence
      </span>
    </div>

    <div class="breakdown">
      <template v-if="modelId === 'composite'">
        <div class="breakdown-row">
          <span class="breakdown-label">Base</span>
          <span class="breakdown-value">{{ formatPercent(recommendation.breakdown.base) }}</span>
        </div>
        <div class="breakdown-row">
          <span class="breakdown-label">Synergy</span>
          <span :class="['breakdown-value', signClass(recommendation.breakdown.synergy)]">
            {{ formatSigned(recommendation.breakdown.synergy) }}
          </span>
        </div>
        <div class="breakdown-row">
          <span class="breakdown-label">Counter</span>
          <span :class="['breakdown-value', signClass(recommendation.breakdown.counter)]">
            {{ formatSigned(recommendation.breakdown.counter) }}
          </span>
        </div>
      </template>
      <template v-else-if="modelId === 'bradley-terry'">
        <div class="breakdown-row">
          <span class="breakdown-label">Strength</span>
          <span class="breakdown-value">{{ recommendation.breakdown.strength?.toFixed(2) }}</span>
        </div>
        <div class="breakdown-row">
          <span class="breakdown-label">Win Prob</span>
          <span class="breakdown-value">{{ formatPercent(recommendation.breakdown.winProbability) }}</span>
        </div>
      </template>
    </div>

    <div v-if="recommendation.relevantNotes.length > 0" class="notes">
      <div
        v-for="(note, i) in recommendation.relevantNotes.slice(0, 2)"
        :key="i"
        class="note"
      >
        {{ formatNoteText(note.text) }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Recommendation } from '@/wandwars/types'

const props = defineProps<{
  recommendation: Recommendation
  rank: number
  modelId: string
  characterImages: Record<string, string>
}>()

const confidenceDescriptions: Record<string, string> = {
  high: 'High confidence: 10+ relevant matches',
  medium: 'Medium confidence: 5-9 relevant matches',
  low: 'Low confidence: <5 relevant matches',
}

const confidenceTooltip = confidenceDescriptions[props.recommendation.confidence]

function formatName(name: string): string {
  return name
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function formatNoteText(text: string): string {
  return text.replace(/\{([^}]+)\}/g, (_, name: string) => formatName(name))
}

function formatScore(score: number): string {
  return (score * 100).toFixed(1) + '%'
}

function formatPercent(value: number | undefined): string {
  if (value === undefined) return '—'
  return (value * 100).toFixed(1) + '%'
}

function formatSigned(value: number | undefined): string {
  if (value === undefined) return '—'
  const pct = (value * 100).toFixed(1)
  return value >= 0 ? `+${pct}%` : `${pct}%`
}

function signClass(value: number | undefined): string {
  if (value === undefined || value === 0) return ''
  return value > 0 ? 'positive' : 'negative'
}
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

.rank {
  font-weight: bold;
  color: var(--color-text-secondary);
  font-size: 1rem;
  min-width: 20px;
}

.hero-portrait {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-round);
  object-fit: cover;
  object-position: top;
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

.score {
  font-size: 0.85rem;
  color: var(--color-primary);
  font-weight: 600;
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

.breakdown-value {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-primary);
}

.breakdown-value.positive {
  color: #1e7e34;
}

.breakdown-value.negative {
  color: #c62828;
}

.notes {
  margin-top: var(--spacing-xs);
  padding-top: var(--spacing-xs);
  border-top: 1px solid var(--color-border-light);
}

.note {
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  font-style: italic;
  line-height: 1.4;
}
</style>

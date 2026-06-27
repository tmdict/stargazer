<script setup lang="ts">
import { computed, ref } from 'vue'

import IconInfo from '@/components/ui/IconInfo.vue'
import TooltipPopup from '@/components/ui/TooltipPopup.vue'
import { useI18nStore } from '@/stores/i18n'
import { formatNoteHtml, formatPercent, joinLocale } from '@/wandwars/formatting'
import type { AggregatePrediction, ModelPrediction } from '@/wandwars/prediction/recommend'

defineProps<{
  aggregatePrediction: AggregatePrediction | null
  allPredictions: ModelPrediction[]
  leftTeam: string[]
  rightTeam: string[]
}>()

const i18n = useI18nStore()

// Confidence-badge tooltip: shared between aggregate and per-model badges.
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

// Per-model description tooltip (info icon next to each model title).
const tooltipModelId = ref<string | null>(null)
const tooltipTarget = ref<HTMLElement | null>(null)

const modelDescriptions = computed<Record<string, string>>(() => ({
  'popular-pick': i18n.t('wandwars.messages/tooltip-model-popular-pick'),
  composite: i18n.t('wandwars.messages/tooltip-model-composite'),
  'bradley-terry': i18n.t('wandwars.messages/tooltip-model-bradley-terry'),
  'adaptive-ml': i18n.t('wandwars.messages/tooltip-model-adaptive-ml'),
}))

function showModelTooltip(modelId: string, event: MouseEvent) {
  tooltipModelId.value = modelId
  tooltipTarget.value = event.currentTarget as HTMLElement
}

function hideModelTooltip() {
  tooltipModelId.value = null
  tooltipTarget.value = null
}

function modelTabLabel(id: string): string {
  if (id === 'composite') return joinLocale(i18n.t('wandwars.hero'), i18n.t('wandwars.synergy'))
  if (id === 'popular-pick') return i18n.t('wandwars.popular-pick')
  if (id === 'bradley-terry') return i18n.t('wandwars.team-power')
  if (id === 'adaptive-ml') return i18n.t('wandwars.adaptive-ml')
  return id
}
</script>

<template>
  <div v-if="aggregatePrediction" class="matchup-section">
    <!-- Aggregate prediction -->
    <div class="matchup-prediction aggregate">
      <div class="matchup-header">
        <h3 class="matchup-title">{{ i18n.t('wandwars.matchup-prediction') }}</h3>
        <span
          :class="['confidence-badge', aggregatePrediction.confidence]"
          @mouseenter="showConfidenceTooltip('aggregate', aggregatePrediction.confidence, $event)"
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
          i18n.t('wandwars.messages/prediction-dataset', {
            matches: aggregatePrediction.matchCount,
            heroes: aggregatePrediction.heroCount,
          })
        }}
      </div>
    </div>

    <!-- Individual model predictions -->
    <div v-for="pred in allPredictions" :key="pred.id" class="matchup-prediction">
      <div class="matchup-header">
        <h3 class="matchup-title">{{ modelTabLabel(pred.id) }}</h3>
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

    <Teleport to="body">
      <TooltipPopup
        v-if="tooltipModelId && tooltipTarget"
        :target-element="tooltipTarget"
        variant="detailed"
        :text="modelDescriptions[tooltipModelId]"
        :max-width="'260px'"
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
</style>

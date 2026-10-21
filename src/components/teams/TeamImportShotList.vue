<script setup lang="ts">
/* The dropped screenshots as cards (ImportShotCard), each with the map it
   fills (read from the strip, or from a formation shot's slot circles), who
   won it (read from the Ally tab; for a formation shot, the team it shows
   instead, read from its board; a replay frame has neither), and the
   reading's state. Two cards on one map both turn red; the modal blocks Save
   as New on it. */

import ImportShotCard from '@/components/import/ImportShotCard.vue'
import type { ShotError } from '@/composables/useImportEngine'
import { shotMapIndex, shotWinner, type ImportShot } from '@/composables/useTeamImport'
import { isFormationReading } from '@/lib/import/screens/formation/types'
import { artifactState, reviewStates, SIDES } from '@/lib/teams/teamImport'
import { Team, teamLabelKey } from '@/lib/types/team'
import { useI18nStore } from '@/stores/i18n'

const {
  shots,
  mapCount,
  formation = false,
  replay = false,
  reviewCount,
  placeCount,
  notice,
} = defineProps<{
  shots: readonly ImportShot[]
  mapCount: number
  // Formation shots: the team shown instead of the winner, read-only.
  formation?: boolean
  // Replay frames: no winner.
  replay?: boolean
  // What a card still asks about, when its owner counts it (a formation shot's
  // units come from the plan); else its cells and artifacts.
  reviewCount?: (shot: ImportShot) => number
  // Units still without a tile, counted once nothing is left to review, since
  // a correction can change which units are missing.
  placeCount?: (shot: ImportShot) => number
  // Why a mapped card adds nothing to the import, when its owner says so.
  notice?: (shot: ImportShot) => string | null
}>()

const selectedId = defineModel<string | null>('selectedId', { required: true })

const emit = defineEmits<{
  setMap: [id: string, mapIndex: number | null]
  setWinner: [id: string, winner: Team | null]
  remove: [id: string]
}>()

const i18n = useI18nStore()

const mapIndexOf = (shot: ImportShot): number | null => shotMapIndex(shot, mapCount)

const shownTeam = (shot: ImportShot): Team | null =>
  shot.reading && isFormationReading(shot.reading) ? shot.reading.side : null

// Formation shots of the two teams share a map, so only the same team twice clashes.
const duplicated = (shot: ImportShot): boolean => {
  const mapIndex = mapIndexOf(shot)
  return (
    mapIndex !== null &&
    shots.some(
      (s) =>
        s !== shot &&
        mapIndexOf(s) === mapIndex &&
        (!formation || shownTeam(s) === shownTeam(shot)),
    )
  )
}

// Cells and artifacts still to look at, as the review shows them: an edit
// settles its cell or artifact.
const cellReviewCount = (shot: ImportShot): number => {
  const reading = shot.reading
  if (!reading) return 0
  return SIDES.reduce(
    (n, team) =>
      n +
      reviewStates(reading, team, shot.overrides).filter((s) => s !== 'sure').length +
      (artifactState(reading, team, shot.artifactOverrides) === 'review' ? 1 : 0),
    0,
  )
}

type StatusTone = 'plain' | 'warn' | 'error'

const ERROR_TEXT: Record<ShotError, string> = {
  'too-small': 'app.import-failed-small',
  unsupported: 'app.import-failed-unsupported',
  references: 'app.import-failed-references',
  worker: 'app.import-failed-references',
  read: 'app.import-failed-unsupported',
}

const status = (shot: ImportShot): { text: string; tone: StatusTone } => {
  if (shot.status === 'reading') return { text: i18n.t('app.import-reading'), tone: 'plain' }
  if (shot.status === 'failed') {
    return { text: i18n.t(ERROR_TEXT[shot.error ?? 'unsupported']), tone: 'error' }
  }
  const reading = shot.reading
  if (reading?.warnings.some((w) => w.kind === 'no-board'))
    return { text: i18n.t('app.import-no-board'), tone: 'error' }
  if (reading?.warnings.some((w) => w.kind === 'no-arena'))
    return { text: i18n.t('app.import-no-arena'), tone: 'error' }
  // A formation shot without cards still places its units.
  if (!formation && reading?.warnings.some((w) => w.kind === 'no-panel'))
    return { text: i18n.t('app.import-no-panel'), tone: 'error' }
  const found = reading?.mapCount ?? null
  if (found !== null && found !== mapCount)
    return { text: i18n.t('app.import-mode-mismatch', { count: found }), tone: 'error' }
  if (mapIndexOf(shot) === null) return { text: i18n.t('app.import-choose-map'), tone: 'warn' }
  const unused = notice?.(shot)
  if (unused) return { text: unused, tone: 'warn' }
  const review = (reviewCount ?? cellReviewCount)(shot)
  if (review) return { text: i18n.t('app.import-to-review', { count: review }), tone: 'warn' }
  const place = placeCount?.(shot) ?? 0
  if (place) return { text: i18n.t('app.import-to-place', { count: place }), tone: 'warn' }
  return { text: i18n.t('app.import-ready'), tone: 'plain' }
}
</script>

<template>
  <div class="shot-list">
    <ImportShotCard
      v-for="shot in shots"
      :key="shot.id"
      :name="shot.name"
      :thumb="shot.thumb"
      :selected="shot.id === selectedId"
      :failed="shot.status === 'failed'"
      :status="status(shot)"
      @select="selectedId = shot.id"
      @remove="emit('remove', shot.id)"
    >
      <template #default>
        <div class="shot-row">
          <span class="shot-label">{{ i18n.t('app.import-map') }}</span>
          <div class="seg" role="group" :aria-label="i18n.t('app.import-map')">
            <button
              v-for="i in mapCount"
              :key="i"
              type="button"
              class="seg-btn"
              :class="{
                on: mapIndexOf(shot) === i - 1,
                dup: mapIndexOf(shot) === i - 1 && duplicated(shot),
              }"
              :aria-pressed="mapIndexOf(shot) === i - 1"
              @click.stop="emit('setMap', shot.id, mapIndexOf(shot) === i - 1 ? null : i - 1)"
            >
              {{ i }}
            </button>
          </div>
        </div>
        <div v-if="formation" class="shot-row">
          <span class="shot-label">{{ i18n.t('app.import-team') }}</span>
          <div class="seg" role="group" :aria-label="i18n.t('app.import-team')">
            <button
              v-for="team in SIDES"
              :key="team"
              type="button"
              class="seg-btn side"
              :class="{
                on: shownTeam(shot) === team,
                ally: team === Team.ALLY,
                enemy: team === Team.ENEMY,
              }"
              :aria-pressed="shownTeam(shot) === team"
              disabled
            >
              {{ i18n.t(teamLabelKey(team)) }}
            </button>
          </div>
        </div>
        <div v-else-if="!replay" class="shot-row">
          <span class="shot-label">{{ i18n.t('app.import-winner') }}</span>
          <div class="seg" role="group" :aria-label="i18n.t('app.import-winner')">
            <button
              v-for="team in SIDES"
              :key="team"
              type="button"
              class="seg-btn side"
              :class="{
                on: shotWinner(shot) === team,
                ally: team === Team.ALLY,
                enemy: team === Team.ENEMY,
              }"
              :aria-pressed="shotWinner(shot) === team"
              :disabled="shot.status !== 'ready'"
              @click.stop="emit('setWinner', shot.id, shotWinner(shot) === team ? null : team)"
            >
              {{ i18n.t(teamLabelKey(team)) }}
            </button>
          </div>
        </div>
      </template>
    </ImportShotCard>
  </div>
</template>

<style scoped>
.shot-list {
  display: grid;
  grid-template-columns: var(--import-columns);
  gap: var(--spacing-sm);
}

@media (max-width: 720px) {
  .shot-list {
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: var(--spacing-md);
  }
}

.shot-row {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.shot-label {
  font-size: 0.66rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--import-label);
}

.seg {
  display: flex;
  border: 1px solid var(--import-border);
  border-radius: var(--radius-medium);
  overflow: hidden;
}

.seg-btn {
  flex: 1 1 0;
  min-width: 0;
  padding: 3px 2px;
  border: none;
  border-right: 1px solid var(--import-border);
  background: transparent;
  color: var(--import-text-dim);
  font: inherit;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  transition:
    background var(--transition-fast),
    color var(--transition-fast);
}

.seg-btn:last-child {
  border-right: none;
}

.seg-btn:hover:not(:disabled) {
  background: var(--import-surface-hover);
  color: var(--import-text);
}

.seg-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

.seg-btn.on {
  background: var(--color-accent-active);
  color: #fff;
}

.seg-btn.on.dup {
  background: var(--color-danger);
}

.seg-btn.on:disabled {
  opacity: 1;
}

.seg-btn.side {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.seg-btn.side.on.ally {
  background: var(--import-ally);
}

.seg-btn.side.on.enemy {
  background: var(--import-enemy);
}

@media (pointer: coarse) {
  .seg-btn {
    padding: 8px 4px;
  }
}
</style>

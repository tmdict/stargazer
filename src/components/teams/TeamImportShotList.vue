<script setup lang="ts">
/* The dropped screenshots as cards: a thumbnail that opens the full image in
   a lightbox, the map it fills (read from the strip), who won it (read from
   the Ally tab), both editable, and the reading's state. Two cards on one map
   both turn red; the modal blocks Save as New on it. */

import { ref } from 'vue'

import IconClose from '@/components/ui/IconClose.vue'
import IconExpand from '@/components/ui/IconExpand.vue'
import ImageLightbox from '@/components/ui/ImageLightbox.vue'
import type { ImportShot, ShotError } from '@/composables/useTeamImport'
import type { RecordNames } from '@/lib/teams/teamImport'
import { Team } from '@/lib/types/team'
import { useI18nStore } from '@/stores/i18n'

const { shots, names } = defineProps<{
  shots: readonly ImportShot[]
  mapCount: number
  names: RecordNames
}>()

const selectedId = defineModel<string | null>('selectedId', { required: true })

const emit = defineEmits<{
  setMap: [id: string, mapIndex: number | null]
  setWinner: [id: string, winner: Team | null]
  remove: [id: string]
}>()

const i18n = useI18nStore()

const SIDES = [Team.ALLY, Team.ENEMY] as const

const zoomed = ref<ImportShot | null>(null)

// The winner segments carry the typed player names once there are any.
const sideLabel = (team: Team): string =>
  team === Team.ALLY
    ? names.left.trim() || i18n.t('app.import-left')
    : names.right.trim() || i18n.t('app.import-right')

const duplicated = (shot: ImportShot): boolean =>
  shot.mapIndex !== null && shots.some((s) => s !== shot && s.mapIndex === shot.mapIndex)

const reviewCount = (shot: ImportShot): number => {
  if (!shot.reading) return 0
  let n = 0
  for (const team of SIDES) {
    for (const cell of shot.reading.sides[team]) if (!cell.sure) n++
  }
  return n
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
  const warnings = shot.reading?.warnings ?? []
  if (warnings.some((w) => w.kind === 'no-panel'))
    return { text: i18n.t('app.import-no-panel'), tone: 'error' }
  const count = warnings.find((w) => w.kind === 'map-count')
  if (count?.kind === 'map-count')
    return { text: i18n.t('app.import-mode-mismatch', { count: count.found }), tone: 'error' }
  if (shot.mapIndex === null) return { text: i18n.t('app.import-choose-map'), tone: 'warn' }
  const n = reviewCount(shot)
  return n
    ? { text: i18n.t('app.import-to-review', { count: n }), tone: 'warn' }
    : { text: i18n.t('app.import-ready'), tone: 'plain' }
}
</script>

<template>
  <div class="shot-list">
    <div
      v-for="shot in shots"
      :key="shot.id"
      class="shot"
      :class="{ selected: shot.id === selectedId, failed: shot.status === 'failed' }"
      role="button"
      tabindex="0"
      @click="selectedId = shot.id"
      @keydown.enter.prevent="selectedId = shot.id"
    >
      <button
        type="button"
        class="shot-thumb"
        :aria-label="i18n.t('app.import-view-full')"
        :title="i18n.t('app.import-view-full')"
        @click.stop="zoomed = shot"
      >
        <img :src="shot.thumb" alt="" />
        <IconExpand :size="14" class="shot-zoom" />
      </button>
      <div class="shot-name" :title="shot.name">{{ shot.name }}</div>
      <div class="shot-row">
        <span class="shot-label">{{ i18n.t('app.import-map') }}</span>
        <div class="seg" role="group" :aria-label="i18n.t('app.import-map')">
          <button
            v-for="i in mapCount"
            :key="i"
            type="button"
            class="seg-btn"
            :class="{
              on: shot.mapIndex === i - 1,
              dup: shot.mapIndex === i - 1 && duplicated(shot),
            }"
            :aria-pressed="shot.mapIndex === i - 1"
            @click.stop="emit('setMap', shot.id, shot.mapIndex === i - 1 ? null : i - 1)"
          >
            {{ i }}
          </button>
        </div>
      </div>
      <div class="shot-row">
        <span class="shot-label">{{ i18n.t('app.import-winner') }}</span>
        <div class="seg" role="group" :aria-label="i18n.t('app.import-winner')">
          <button
            v-for="team in SIDES"
            :key="team"
            type="button"
            class="seg-btn side"
            :class="{
              on: shot.winner === team,
              left: team === Team.ALLY,
              right: team === Team.ENEMY,
            }"
            :aria-pressed="shot.winner === team"
            :disabled="shot.status !== 'ready'"
            @click.stop="emit('setWinner', shot.id, shot.winner === team ? null : team)"
          >
            {{ sideLabel(team) }}
          </button>
        </div>
      </div>
      <div class="shot-status" :class="status(shot).tone">{{ status(shot).text }}</div>
      <button
        type="button"
        class="shot-remove"
        :aria-label="i18n.t('app.import-remove')"
        :title="i18n.t('app.import-remove')"
        @click.stop="emit('remove', shot.id)"
      >
        <IconClose :size="12" />
      </button>
    </div>
    <ImageLightbox v-if="zoomed" :src="zoomed.thumb" :alt="zoomed.name" @close="zoomed = null" />
  </div>
</template>

<style scoped>
.shot-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: var(--spacing-md);
}

.shot {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm);
  background: var(--import-surface);
  border: 1px solid var(--import-border);
  border-radius: var(--radius-large);
  color: var(--import-text);
  font-size: 0.78rem;
  cursor: pointer;
  transition: border-color var(--transition-fast);
}

.shot:hover {
  border-color: var(--import-border-strong);
}

.shot.selected {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 1px var(--color-accent);
}

.shot.failed {
  border-color: var(--import-bad);
}

.shot-thumb {
  position: relative;
  display: block;
  width: 100%;
  height: 80px;
  padding: 0;
  border: none;
  border-radius: var(--radius-medium);
  background: rgba(0, 0, 0, 0.35);
  overflow: hidden;
  cursor: zoom-in;
}

.shot-thumb img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: top;
  transition: filter var(--transition-fast);
}

.shot-thumb:hover img,
.shot-thumb:focus-visible img {
  filter: brightness(1.15);
}

.shot-zoom {
  position: absolute;
  right: 6px;
  bottom: 6px;
  padding: 3px;
  border-radius: var(--radius-small);
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.shot-thumb:hover .shot-zoom,
.shot-thumb:focus-visible .shot-zoom {
  opacity: 1;
}

@media (pointer: coarse) {
  .shot-zoom {
    opacity: 1;
  }
}

.shot-name {
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.shot-row {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.shot-label {
  flex: 0 0 48px;
  font-size: 0.66rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--import-label);
}

.seg {
  display: inline-flex;
  min-width: 0;
  flex: 1 1 auto;
  border: 1px solid var(--import-border);
  border-radius: var(--radius-medium);
  overflow: hidden;
}

.seg-btn {
  flex: 1 1 0;
  min-width: 26px;
  padding: 3px 4px;
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

.seg-btn.side {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* The game's own result colours: orange for the left player, blue for the right. */
.seg-btn.side.on.left {
  background: var(--import-left);
}

.seg-btn.side.on.right {
  background: var(--import-right);
}

.shot-status {
  font-size: 0.75rem;
  color: var(--import-text-dim);
}

.shot-status.warn {
  color: var(--import-warn);
}

.shot-status.error {
  color: var(--import-bad);
}

.shot-remove {
  position: absolute;
  top: 12px;
  right: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  cursor: pointer;
}

.shot-remove:hover {
  background: var(--color-danger);
}

@media (pointer: coarse) {
  .seg-btn {
    min-width: 36px;
    padding: 8px 6px;
  }
}
</style>

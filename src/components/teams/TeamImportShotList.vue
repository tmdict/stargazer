<script setup lang="ts">
/* The dropped screenshots as cards: thumbnail, the map each one fills (read
   from the strip, editable), this map's result, and the reading's state.
   Two cards on one map both turn red; the modal blocks Replace on it. */

import type { ImportShot } from '@/composables/useTeamImport'
import { Team } from '@/lib/types/team'
import { useI18nStore } from '@/stores/i18n'

const { shots, mapCount, selectedId } = defineProps<{
  shots: readonly ImportShot[]
  mapCount: number
  selectedId: string | null
}>()

const emit = defineEmits<{
  select: [id: string]
  setMap: [id: string, mapIndex: number | null]
  remove: [id: string]
}>()

const i18n = useI18nStore()

const duplicated = (shot: ImportShot): boolean =>
  shot.mapIndex !== null && shots.some((s) => s !== shot && s.mapIndex === shot.mapIndex)

const reviewCount = (shot: ImportShot): number => {
  if (!shot.reading) return 0
  let n = 0
  for (const team of [Team.ALLY, Team.ENEMY]) {
    for (const cell of shot.reading.sides[team]) if (!cell.recognised || cell.margin < 0.1) n++
  }
  return n
}

const status = (shot: ImportShot): string => {
  if (shot.status === 'reading') return i18n.t('app.import-reading')
  if (shot.status === 'failed') {
    if (shot.error === 'too-small') return i18n.t('app.import-failed-small')
    if (shot.error === 'references' || shot.error === 'worker')
      return i18n.t('app.import-failed-references')
    return i18n.t('app.import-failed-unsupported')
  }
  const n = reviewCount(shot)
  return n ? i18n.t('app.import-to-review', { count: n }) : i18n.t('app.import-ready')
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
      @click="emit('select', shot.id)"
      @keydown.enter.prevent="emit('select', shot.id)"
    >
      <img class="shot-thumb" :src="shot.thumb" alt="" />
      <div class="shot-name" :title="shot.name">{{ shot.name }}</div>
      <div class="shot-maps" role="group" :aria-label="i18n.t('app.maps')">
        <button
          v-for="i in mapCount"
          :key="i"
          type="button"
          class="map-seg"
          :class="{ on: shot.mapIndex === i - 1, dup: shot.mapIndex === i - 1 && duplicated(shot) }"
          :aria-pressed="shot.mapIndex === i - 1"
          @click.stop="emit('setMap', shot.id, shot.mapIndex === i - 1 ? null : i - 1)"
        >
          {{ i }}
        </button>
      </div>
      <div class="shot-status">
        <span v-if="shot.reading?.winner === Team.ALLY" class="result left">{{
          i18n.t('app.import-left-won')
        }}</span>
        <span v-else-if="shot.reading?.winner === Team.ENEMY" class="result right">{{
          i18n.t('app.import-right-won')
        }}</span>
        <span v-else-if="shot.status === 'ready' && shot.mapIndex === null">{{
          i18n.t('app.import-choose-map')
        }}</span>
        <span
          :class="{
            warn: shot.status === 'ready' && reviewCount(shot) > 0,
            error: shot.status === 'failed',
          }"
        >
          {{ status(shot) }}
        </span>
      </div>
      <button
        type="button"
        class="shot-remove"
        :aria-label="i18n.t('app.import-remove')"
        :title="i18n.t('app.import-remove')"
        @click.stop="emit('remove', shot.id)"
      >
        ×
      </button>
    </div>
  </div>
</template>

<style scoped>
.shot-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: var(--spacing-sm);
}

.shot {
  position: relative;
  background: var(--color-bg-white);
  border: 1.5px solid var(--color-border-primary);
  border-radius: var(--radius-large);
  padding: var(--spacing-sm);
  font-size: 0.78rem;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.shot.selected {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 30%, transparent);
}

.shot.failed {
  border-color: var(--color-error);
}

.shot-thumb {
  width: 100%;
  height: 70px;
  object-fit: cover;
  object-position: top;
  border-radius: var(--radius-medium);
  background: #333;
}

.shot-name {
  font-weight: 600;
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.shot-maps {
  display: inline-flex;
  border: 1.5px solid var(--color-border-primary);
  border-radius: var(--radius-medium);
  overflow: hidden;
  align-self: flex-start;
}

.map-seg {
  border: none;
  border-right: 1px solid var(--color-border-primary);
  background: var(--color-bg-white);
  color: var(--color-text-secondary);
  font: inherit;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  padding: 2px 8px;
  min-width: 28px;
  cursor: pointer;
}

.map-seg:last-child {
  border-right: none;
}

.map-seg.on {
  background: var(--color-primary);
  color: #fff;
}

.map-seg.dup {
  background: var(--color-error);
}

.shot-status {
  display: flex;
  justify-content: space-between;
  gap: 6px;
  color: var(--color-text-secondary);
  flex-wrap: wrap;
}

.result {
  font-weight: 700;
}

.result.left {
  color: #c96a25;
}

.result.right {
  color: #5d7bb0;
}

.warn {
  color: #8a6100;
}

.error {
  color: var(--color-error);
}

.shot-remove {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: none;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-size: 1rem;
  line-height: 1;
  cursor: pointer;
}

@media (pointer: coarse) {
  .map-seg {
    min-width: 36px;
    padding: 8px 6px;
  }
}
</style>

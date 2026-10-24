<script setup lang="ts">
/* One map of the set: the board as it was recorded, its artifact on its cell,
   then the comp's record on the map, the core heroes to keep and the swaps
   recorded in place of a hero. A win rate shows from eight decided games,
   green from 60% and red to 40%, as the report colours one. */

import { computed } from 'vue'

import type { SlShownTeam } from './SlResult.vue'
import BoardThumbnail from '@/components/grid/BoardThumbnail.vue'
import GuidePortrait from '@/components/guide/GuidePortrait.vue'
import IconArrowRight from '@/components/ui/IconArrowRight.vue'
import { usePreviewImages } from '@/composables/usePreviewImages'
import type { PreviewBoard } from '@/lib/teams/preview'
import { useI18nStore } from '@/stores/i18n'
import { useSlNames } from './useSlNames'

const { team, board } = defineProps<{ team: SlShownTeam; board: PreviewBoard | undefined }>()

const TONE_GAMES = 8

const i18n = useI18nStore()
const lang = computed(() => i18n.currentLocale)
const { heroSlug, groupName } = useSlNames()
const { thumbnailUnit, thumbnailArtifact } = usePreviewImages()

const record = computed(() => {
  if (!team.comp) return null
  const [players, wins, losses] = team.comp
  const decided = wins + losses
  const rate = decided ? wins / decided : 0
  return {
    players,
    wins,
    losses,
    rate: decided >= TONE_GAMES ? Math.round(rate * 100) : null,
    tone: decided < TONE_GAMES ? '' : rate >= 0.6 ? 'good' : rate <= 0.4 ? 'bad' : '',
  }
})
</script>

<template>
  <article class="sl-col">
    <header class="sl-col-head">
      <span class="sl-map">{{ i18n.t('app.sl-map', { n: team.map + 1 }) }}</span>
      <span class="sl-group">{{ groupName(team) }}</span>
    </header>
    <BoardThumbnail
      v-if="board"
      class="sl-board"
      :map-key="board.mapKey"
      :tiles="board.tiles"
      :units="board.units.map(thumbnailUnit)"
      :artifacts="{ ally: thumbnailArtifact(board.artifacts.ally) }"
      :hex-size="18"
      crisp
      numbered
    />
    <p v-if="record" class="sl-record" :title="i18n.t('app.sl-record-tip')">
      <span>{{ i18n.t('app.sl-players', { count: record.players }) }}</span>
      <b v-if="record.rate !== null" :class="record.tone">{{ record.rate }}%</b>
      <small>{{ record.wins }}–{{ record.losses }}</small>
    </p>
    <div v-if="team.core.length" class="sl-row sl-core" :title="i18n.t('app.sl-core-tip')">
      <span class="sl-label">{{ i18n.t('app.sl-core') }}</span>
      <span class="sl-faces">
        <GuidePortrait v-for="id in team.core" :key="id" :slug="heroSlug(id)" :lang />
      </span>
    </div>
    <div v-if="team.flex.length" class="sl-row sl-flex" :title="i18n.t('app.sl-swaps-tip')">
      <span class="sl-label">{{ i18n.t('app.sl-swaps') }}</span>
      <span class="sl-swaps">
        <span v-for="swap in team.flex" :key="swap.out" class="sl-faces">
          <GuidePortrait :slug="heroSlug(swap.out)" :lang />
          <IconArrowRight :size="12" class="sl-arrow" />
          <GuidePortrait v-for="id in swap.options" :key="id" :slug="heroSlug(id)" :lang />
        </span>
      </span>
    </div>
  </article>
</template>

<style scoped>
/* Five rows shared with the other maps in its row of the set (SlResult), so
   a group name that wraps further does not push one board below the others. */
.sl-col {
  --size: 28px;
  display: grid;
  grid-row: span 5;
  grid-template-rows: subgrid;
  align-content: start;
  row-gap: var(--spacing-sm);
  min-width: 0;
}

.sl-col-head {
  grid-row: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.sl-map {
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-text-secondary);
}

.sl-group {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-primary);
  overflow-wrap: anywhere;
}

/* The crisp board style is drawn for a dark backdrop, as in the saved-team
   preview. */
.sl-board {
  grid-row: 2;
  width: 100%;
  height: auto;
  padding: 6px;
  border-radius: var(--radius-medium);
  background: var(--color-bg-reading);
}

.sl-record {
  grid-row: 3;
  display: flex;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 2px var(--spacing-sm);
  margin: 0;
  font-size: 0.85rem;
  color: var(--color-text-primary);
}

.sl-record small {
  color: var(--color-text-secondary);
}

.sl-record .good {
  color: var(--color-success);
}

.sl-record .bad {
  color: var(--color-danger);
}

.sl-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.sl-core {
  grid-row: 4;
}

.sl-flex {
  grid-row: 5;
}

.sl-label {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--color-text-secondary);
}

.sl-swaps {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.sl-faces {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 5px;
}

.sl-arrow {
  color: var(--color-primary);
}

@container (max-width: 560px) {
  .sl-col {
    --size: 24px;
  }
  .sl-faces {
    gap: 4px;
  }
}
</style>

<script setup lang="ts">
/* One map of the set: the board as it was recorded, its artifact on its cell,
   then the comp's record on the map, the core heroes to keep and the swaps
   recorded in place of a hero. A win rate shows from eight decided games,
   green from 60% and red to 40%, as the report colours one. */

import { computed } from 'vue'

import SlIcon from './SlIcon.vue'
import SlPortrait from './SlPortrait.vue'
import type { SlShownTeam } from './SlResult.vue'
import BoardThumbnail from '@/components/grid/BoardThumbnail.vue'
import { usePreviewImages } from '@/composables/usePreviewImages'
import type { PreviewBoard } from '@/lib/teams/preview'
import { useI18nStore } from '@/stores/i18n'

const { team, board } = defineProps<{ team: SlShownTeam; board: PreviewBoard | undefined }>()

const TONE_GAMES = 8

const i18n = useI18nStore()
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
  <article class="sl-col" :aria-label="i18n.t('app.sl-map', { n: team.map + 1 })">
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
    <!-- Two columns, the icons and what they lead; a gap opens above the core
         and swap rows when another row comes before them. -->
    <div class="sl-aside">
      <div class="sl-aside-in">
        <template v-if="record">
          <span />
          <span class="sl-stats" :title="i18n.t('app.sl-record-tip')">
            <span class="sl-stat">
              <SlIcon name="players" class="sl-small-icon" />
              <b>{{ record.players }}</b>
            </span>
            <span class="sl-stat">
              <SlIcon name="record" class="sl-small-icon" />
              <b v-if="record.rate !== null" :class="record.tone">{{ record.rate }}%</b>
              <small>{{ record.wins }}–{{ record.losses }}</small>
            </span>
          </span>
        </template>
        <template v-if="team.core.length">
          <span class="sl-label" :class="{ start: record }" :title="i18n.t('app.sl-core-tip')">
            <SlIcon name="lock" :label="i18n.t('app.sl-core')" />
          </span>
          <span class="sl-faces" :class="{ start: record }">
            <SlPortrait v-for="id in team.core" :key="id" :id />
          </span>
        </template>
        <template v-for="(swap, index) in team.flex" :key="swap.out">
          <span v-if="index" />
          <span
            v-else
            class="sl-label"
            :class="{ start: record || team.core.length }"
            :title="i18n.t('app.sl-swaps-tip')"
          >
            <SlIcon name="swap" :label="i18n.t('app.sl-swaps')" />
          </span>
          <span class="sl-swap" :class="{ start: !index && (record || team.core.length) }">
            <SlPortrait :id="swap.out" />
            <SlIcon name="arrow" class="sl-arrow" />
            <span class="sl-faces">
              <SlPortrait v-for="id in swap.options" :key="id" :id />
            </span>
          </span>
        </template>
      </div>
    </div>
  </article>
</template>

<style scoped>
.sl-col {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.sl-board {
  width: 100%;
  height: auto;
}

/* The block sits a little left of the board's middle, under the ally tiles,
   as on the infographic. */
.sl-aside {
  display: flex;
  justify-content: safe center;
  margin-top: 16px;
  padding-right: var(--sl-aside-offset, 34%);
}

.sl-aside-in {
  display: grid;
  grid-template-columns: auto auto;
  align-items: center;
  column-gap: 10px;
  row-gap: 8px;
}

.sl-aside-in .start {
  margin-top: 14px;
}

.sl-stats {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  font-size: 15px;
}

.sl-stat {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  white-space: nowrap;
}

.sl-stat:first-child {
  min-width: 3.4em;
}

.sl-stat b {
  font-weight: 700;
}

.sl-stat small {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.sl-stat .good {
  color: var(--sl-good);
}

.sl-stat .bad {
  color: var(--sl-bad);
}

.sl-small-icon {
  width: 19px;
  height: 19px;
  color: var(--color-text-secondary);
}

.sl-label {
  display: flex;
  color: var(--color-text-secondary);
}

.sl-faces,
.sl-swap {
  display: flex;
  align-items: center;
}

.sl-faces {
  gap: var(--pt-gap, 15px);
}

.sl-arrow {
  width: 18px;
  height: 18px;
  margin: 0 6px;
  color: var(--color-primary);
}
/* Two maps to a row on a phone (SlResult): the record takes smaller type and
   may wrap. */
@container (max-width: 600px) {
  .sl-aside-in {
    column-gap: 6px;
  }
  .sl-stats {
    flex-wrap: wrap;
    gap: 2px 8px;
    font-size: 13px;
  }
  .sl-stat:first-child {
    min-width: 0;
  }
  .sl-stat small {
    font-size: 11px;
  }
  .sl-small-icon {
    width: 15px;
    height: 15px;
  }
  .sl-label .sl-icon {
    width: 18px;
    height: 18px;
  }
  .sl-arrow {
    width: 14px;
    height: 14px;
    margin: 0 3px;
  }
}
</style>

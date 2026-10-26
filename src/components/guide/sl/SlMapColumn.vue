<script setup lang="ts">
/* One map of the set: the board as it was recorded, its artifact on its cell,
   then the comp's record on the map, the core heroes to keep and the swaps
   recorded in place of one hero or two. A win rate shows from eight decided
   games, green from 60% and red to 40%, as the report colours one. Its host
   sizes it: --pt for the portraits, and --sl-scale for the gaps and icons of
   the core and swap rows (1 on the generator's page, smaller on the guide
   index's card, which shows no record). */

import { computed } from 'vue'

import SlIcon from './SlIcon.vue'
import SlPortrait from './SlPortrait.vue'
import type { SlShownTeam } from './SlResult.vue'
import BoardThumbnail from '@/components/grid/BoardThumbnail.vue'
import { usePreviewImages } from '@/composables/usePreviewImages'
import type { PreviewBoard } from '@/lib/teams/preview'
import { useI18nStore } from '@/stores/i18n'

const {
  team,
  board,
  numbered = true,
} = defineProps<{
  team: Pick<SlShownTeam, 'map' | 'comp' | 'core' | 'flex' | 'pairs'>
  board: PreviewBoard | undefined
  numbered?: boolean
}>()

const TONE_GAMES = 8

const i18n = useI18nStore()
const { thumbnailUnit, thumbnailArtifact } = usePreviewImages()

const swaps = computed(() => [
  ...team.flex.map(({ out, options }) => ({
    out: [out],
    options: options.map((id) => [id]),
  })),
  ...team.pairs,
])

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
      :numbered
    />
    <!-- Two columns, the icons and what they lead. -->
    <div class="sl-aside">
      <div class="sl-aside-in">
        <template v-if="record">
          <span />
          <span class="sl-stats">
            <span class="sl-stat" :title="i18n.t('app.sl-players-tip')">
              <SlIcon name="players" class="sl-small-icon" />
              <b>{{ record.players }}</b>
            </span>
            <span class="sl-stat" :title="i18n.t('app.sl-record-tip')">
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
        <template v-for="(swap, index) in swaps" :key="swap.out.join()">
          <span v-if="index" />
          <span
            v-else
            class="sl-label"
            :class="{ start: record || team.core.length, top: swap.out.length > 1 }"
            :title="i18n.t('app.sl-swaps-tip')"
          >
            <SlIcon name="swap" :label="i18n.t('app.sl-swaps')" />
          </span>
          <span
            class="sl-swap"
            :class="{ start: !index && (record || team.core.length), top: swap.out.length > 1 }"
          >
            <span class="sl-from">
              <span class="sl-pair">
                <SlPortrait v-for="id in swap.out" :key="id" :id />
              </span>
              <SlIcon name="arrow" class="sl-arrow" />
            </span>
            <span class="sl-options" :class="{ stacked: swap.out.length > 1 }">
              <span v-for="option in swap.options" :key="option.join()" class="sl-pair">
                <SlPortrait v-for="id in option" :key="id" :id />
              </span>
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

.sl-aside {
  --s: var(--sl-scale, 1);
  display: flex;
  justify-content: safe center;
  margin-top: calc(16px * var(--s));
  padding-right: var(--sl-aside-offset, 34%);
}

.sl-aside-in {
  display: grid;
  grid-template-columns: auto auto;
  align-items: center;
  column-gap: calc(10px * var(--s));
  row-gap: calc(8px * var(--s));
}

.sl-aside-in .start {
  margin-top: calc(14px * var(--s));
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

.sl-label .sl-icon {
  width: calc(24px * var(--s));
  height: calc(24px * var(--s));
}

.sl-faces,
.sl-swap,
.sl-from,
.sl-options,
.sl-pair {
  display: flex;
  align-items: center;
}

.sl-swap.top {
  align-items: flex-start;
}

.sl-label.top {
  align-self: start;
  align-items: center;
  height: var(--pt, 40px);
}

.sl-faces,
.sl-options {
  gap: var(--pt-gap, 15px);
}

.sl-options.stacked {
  flex-direction: column;
  gap: calc(6px * var(--s));
}

.sl-pair {
  gap: 3px;
}

.sl-arrow {
  width: calc(18px * var(--s));
  height: calc(18px * var(--s));
  margin: 0 calc(6px * var(--s));
  color: var(--color-primary);
}
</style>

<script setup lang="ts">
/* One map of the set: the board, its artifact on its cell, the switch between
   the formation of a recorded game and the engine's on a board that has one,
   then the comp's record on the map, the team's chance to win the map, the core
   heroes to keep and the swaps recorded in place of one hero or two. A win rate
   shows from eight decided games, green from 60% and red to 40%, as the report
   colours one. Its host sizes it: --pt for
   the portraits, and --sl-unit, the length of one of the generator page's
   pixels, for the gaps and icons of the core and swap rows (1px there, a share
   of its column's width on the guide index's card, which shows no record).
   Hovering or tapping a swap's heroes tries them on the board when the team
   can try swaps. */

import { computed, ref, useTemplateRef, watch } from 'vue'

import SlFormationSwitch from './SlFormationSwitch.vue'
import SlIcon from './SlIcon.vue'
import SlMapBoard from './SlMapBoard.vue'
import SlPortrait from './SlPortrait.vue'
import type { SlShownTeam } from './SlResult.vue'
import SlSwapCard from './SlSwapCard.vue'
import { useInfoTip } from '@/composables/useInfoTip'
import type { PlacementExplanation } from '@/lib/placement/explain'
import type { SwapPreview } from '@/lib/pvp/sl/generator/swapPreview'
import type { PreviewBoard } from '@/lib/teams/preview'
import { useI18nStore } from '@/stores/i18n'
import { slPercent } from './useSlNames'

// engineOn: the board shows the engine's formation in place of a recorded
// game's. why: the shown formation's.
const { team, engineOn = false } = defineProps<{
  team: Pick<SlShownTeam, 'map' | 'comp' | 'core' | 'flex' | 'pairs'> &
    Partial<Pick<SlShownTeam, 'chance' | 'trySwap' | 'played' | 'engine'>>
  board: PreviewBoard | undefined
  why?: PlacementExplanation | null
  engineOn?: boolean
}>()

const emit = defineEmits<{ switch: [engineOn: boolean] }>()

const TONE_GAMES = 8

const i18n = useI18nStore()

const swaps = computed(() => [
  ...team.flex.map(({ out, options }) => ({
    out: [out],
    options: options.map((id) => [id]),
  })),
  ...team.pairs,
])

const {
  anchor,
  payload: tried,
  hoverOpen,
  hoverClose,
  toggle,
  onTouchStart,
  close,
} = useInfoTip<{ out: number[]; into: number[] }>()
const preview = ref<SwapPreview | null>(null)
const boardView = useTemplateRef<InstanceType<typeof SlMapBoard>>('board')
// The board, which the card of a swap below it opens above when it fits.
const boardBox = {
  getBoundingClientRect: (): DOMRect => boardView.value?.box() ?? new DOMRect(),
}
const canTry = computed(() => !!team.trySwap && team.chance !== undefined)

// Columns are kept by board when another set is drawn, and a swap is tried on
// one team in one formation.
watch([() => team.trySwap, () => engineOn], close)

// The worker answers after a moment, by when another swap may be shown.
watch(tried, async (swap) => {
  preview.value = null
  if (!swap || !team.trySwap) return
  const found = await team.trySwap(swap.out, swap.into, engineOn)
  if (tried.value === swap) preview.value = found
})

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
const stats = computed(() => !!record.value || team.chance !== undefined)
</script>

<template>
  <article class="sl-col" :aria-label="i18n.t('app.sl-map', { n: team.map + 1 })">
    <SlMapBoard v-if="board" ref="board" :board :why :swap="preview" />
    <SlFormationSwitch
      v-if="board && team.played"
      class="sl-formation-switch"
      :engine-on
      :ready="!!team.engine"
      :moved="team.played.moved"
      @switch="emit('switch', $event)"
    />
    <SlSwapCard
      v-if="anchor && tried && preview && team.chance !== undefined"
      :anchor
      :clear-of="boardBox"
      :into="tried.into"
      :before="team.chance"
      :after="preview.chance"
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
        <template v-if="team.chance !== undefined">
          <span />
          <span class="sl-stats">
            <span class="sl-stat" :title="i18n.t('app.sl-map-chance-tip')">
              <SlIcon name="chance" :share="team.chance" class="sl-small-icon" />
              <b>{{ slPercent(team.chance) }}</b>
            </span>
          </span>
        </template>
        <template v-if="team.core.length">
          <span class="sl-label" :class="{ start: stats }" :title="i18n.t('app.sl-core-tip')">
            <SlIcon name="lock" :label="i18n.t('app.sl-core')" />
          </span>
          <span class="sl-faces" :class="{ start: stats }">
            <SlPortrait v-for="id in team.core" :key="id" :id />
          </span>
        </template>
        <template v-for="(swap, index) in swaps" :key="swap.out.join()">
          <span v-if="index" />
          <span
            v-else
            class="sl-label"
            :class="{ start: stats || team.core.length, top: swap.out.length > 1 }"
            :title="i18n.t('app.sl-swaps-tip')"
          >
            <SlIcon name="swap" :label="i18n.t('app.sl-swaps')" />
          </span>
          <span
            class="sl-swap"
            :class="{ start: !index && (stats || team.core.length), top: swap.out.length > 1 }"
          >
            <span class="sl-from">
              <span class="sl-pair">
                <SlPortrait v-for="id in swap.out" :key="id" :id />
              </span>
              <SlIcon name="arrow" class="sl-arrow" />
            </span>
            <span class="sl-options" :class="{ stacked: swap.out.length > 1 }">
              <span
                v-for="option in swap.options"
                :key="option.join()"
                class="sl-pair"
                :class="{ 'sl-try': canTry }"
                @mouseenter="canTry && hoverOpen($event, { out: swap.out, into: option })"
                @mouseleave="hoverClose"
                @click="canTry && toggle($event, { out: swap.out, into: option })"
                @touchstart.passive="onTouchStart"
              >
                <SlPortrait v-for="id in option" :key="id" :id :titled="!canTry" />
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
  position: relative;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.sl-formation-switch {
  position: absolute;
  top: 2px;
  left: 2px;
}

.sl-aside {
  --u: var(--sl-unit, 1px);
  display: flex;
  justify-content: safe center;
  margin-top: calc(16 * var(--u));
  padding-right: var(--sl-aside-offset, 34%);
}

.sl-aside-in {
  display: grid;
  grid-template-columns: auto auto;
  align-items: center;
  column-gap: calc(10 * var(--u));
  row-gap: calc(8 * var(--u));
}

.sl-aside-in .start {
  margin-top: calc(14 * var(--u));
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
  color: var(--color-success);
}

.sl-stat .bad {
  color: var(--color-danger-text);
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
  width: calc(24 * var(--u));
  height: calc(24 * var(--u));
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
  gap: calc(6 * var(--u));
}

.sl-pair {
  gap: calc(3 * var(--u));
}

.sl-try {
  cursor: pointer;
}

.sl-arrow {
  width: calc(18 * var(--u));
  height: calc(18 * var(--u));
  margin: 0 calc(6 * var(--u));
  color: var(--color-primary);
}
</style>

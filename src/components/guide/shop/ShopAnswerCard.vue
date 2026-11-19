<script setup lang="ts">
/* The answers for one goal: the move with the best chance this round and the
   move that costs the fewest badges, each with the other moves it was weighed
   against, and what to do before stopping when either says to stop. A chance
   is a range while the search has not settled it. The fewest badges shown is
   the ceiling of its range, the figure a player can count on. */

import { computed } from 'vue'

import ShopPieceDisc from './ShopPieceDisc.vue'
import ShopSteps from './ShopSteps.vue'
import GuidePortrait from '@/components/guide/GuidePortrait.vue'
import { sameMove } from '@/lib/hd/shop/advice'
import { SHOWN_RANGE, type ShopAnswer } from '@/lib/hd/shop/calculate'
import type { ChanceRange, CostRange, Move, ShopCard } from '@/lib/hd/shop/types'
import { useI18nStore } from '@/stores/i18n'
import { duelEquipment, equipmentTierLabel } from '@/utils/duelCatalog'
import { curatedHeroName } from '@/utils/skillLabels'
import { cardName, moveSteps, pieceName, stopSteps } from './shopGoods'

const { answer, cards, copies, basis } = defineProps<{
  answer: ShopAnswer
  cards: readonly ShopCard[]
  // The move the answers start from, when the player chose one over the shop as entered.
  basis: Move | null
  // The copies wanted of the goal's hero.
  copies?: number
  // Whether the search is still narrowing the chances.
  working: boolean
}>()

const emit = defineEmits<{ recalculate: [move: Move] }>()

const i18n = useI18nStore()

const start = computed(
  (): Move =>
    basis ?? {
      kind: 'reroll',
      locks: cards.flatMap((card, index) => (card.locked && !card.bought ? [index] : [])),
    },
)

// A move worth recalculating from: null when the answers already start from it.
const untried = (move: Move | undefined): Move | null =>
  move && !sameMove(move, start.value) ? move : null

const piece = computed(() => {
  const { goal } = answer
  return goal.kind === 'equipment' ? duelEquipment.find((one) => one.name === goal.name) : undefined
})

const head = computed(() => {
  const { goal } = answer
  const locale = i18n.currentLocale
  if (goal.kind === 'hero') {
    return {
      title: curatedHeroName(goal.name, locale),
      sub: i18n.t('app.shop-copies-wanted', { copies: copies ?? 1 }),
    }
  }
  if (goal.kind === 'equipment') {
    return {
      title: pieceName(goal.name, locale),
      sub: piece.value ? equipmentTierLabel(piece.value.tier, locale) : '',
    }
  }
  return { title: i18n.t(`app.shop-goal-${goal.kind}`), sub: '' }
})

const percent = (chance: number): string => {
  const value = chance * 100
  if (value >= 99.95) return '100%'
  return `${value.toFixed(value < 1 ? 2 : 1)}%`
}

const chanceText = ({ floor, ceiling }: ChanceRange): string =>
  ceiling - floor >= SHOWN_RANGE ? `${percent(floor)} – ${percent(ceiling)}` : percent(floor)

const badgeText = (cost: CostRange): string => String(Number(cost.ceiling.toFixed(1)))

const chanceRows = computed(() => {
  const { keepLocks, current, offers } = answer.chance
  return [
    keepLocks && {
      label: i18n.t('app.shop-alt-keep-locks'),
      figure: chanceText(keepLocks.chance),
      steps: moveSteps(keepLocks.move, cards),
      retry: untried(keepLocks.move),
    },
    current && {
      label: i18n.t(basis ? 'app.shop-alt-basis' : 'app.shop-alt-current'),
      figure: chanceText(current.chance),
      steps: basis ? moveSteps(current.move, cards) : [],
      retry: null,
    },
    offers &&
      offers.first !== null && {
        label: i18n.t('app.shop-alt-offers'),
        figure: percent(offers.chance),
        steps: moveSteps({ kind: 'buy', card: offers.first }, cards),
        retry: null,
      },
  ].filter((row) => !!row)
})

const badgeRows = computed(() => {
  const { next, keepLocks } = answer.badges
  return [
    next && {
      label: i18n.t('app.shop-alt-next'),
      figure: badgeText(next.cost),
      steps: moveSteps(next.move, cards),
    },
    keepLocks && {
      label: i18n.t('app.shop-alt-keep-locks'),
      figure: badgeText(keepLocks.cost),
      steps: moveSteps(keepLocks.move, cards),
    },
  ].filter((row) => !!row)
})

const STOP_TEXT = {
  unaffordable: 'app.shop-stop-unaffordable',
  impossible: 'app.shop-stop-chance',
  'next-level': 'app.shop-stop-next-level',
}

// Two locked cards of one name share a line.
const idle = computed(() => [
  ...new Set(
    answer.idleLocks.flatMap((index) => {
      const card = cards[index]
      return card ? [cardName(card, i18n)] : []
    }),
  ),
])
</script>

<template>
  <article class="shop-answer">
    <header>
      <GuidePortrait
        v-if="answer.goal.kind === 'hero'"
        :slug="answer.goal.name"
        :lang="i18n.currentLocale"
        :size="44"
      />
      <ShopPieceDisc v-else-if="piece" :name="piece.name" :size="44" />
      <h3>
        {{ head.title }}
        <small v-if="head.sub">{{ head.sub }}</small>
      </h3>
    </header>

    <section v-if="answer.chance.best" class="part">
      <p class="shop-label accent">{{ i18n.t('app.shop-best-chance') }}</p>
      <p class="figure">
        <b>{{ chanceText(answer.chance.best.chance) }}</b>
        {{ i18n.t('app.shop-this-round') }}
      </p>
      <ShopSteps :steps="moveSteps(answer.chance.best.move, cards)" :cards />
      <dl v-if="chanceRows.length" class="rows">
        <template v-for="row in chanceRows" :key="row.label">
          <dt>{{ row.label }}</dt>
          <dd>
            <b>{{ row.figure }}</b>
            <ShopSteps v-if="row.steps.length" :steps="row.steps" :cards />
            <button
              v-if="row.retry"
              type="button"
              class="shop-pill-button retry"
              @click="emit('recalculate', row.retry)"
            >
              {{ i18n.t('app.shop-recalculate-keep-locks') }}
            </button>
          </dd>
        </template>
      </dl>
      <p v-if="!answer.chance.certain" class="shop-note">
        {{ i18n.t(working ? 'app.shop-narrowing' : 'app.shop-unsure') }}
      </p>
      <button
        v-if="untried(answer.chance.best.move)"
        type="button"
        class="shop-pill-button retry"
        @click="emit('recalculate', answer.chance.best.move)"
      >
        {{ i18n.t('app.shop-recalculate-best') }}
      </button>
    </section>
    <section v-else class="part">
      <p class="shop-label warn">{{ i18n.t('app.shop-stop') }}</p>
      <p class="text">{{ i18n.t('app.shop-stop-chance') }}</p>
    </section>

    <section class="part">
      <p class="shop-label" :class="answer.badges.best && !answer.badges.stop ? 'accent' : 'warn'">
        {{ i18n.t('app.shop-fewest-badges') }}
      </p>
      <p v-if="!answer.badges.best" class="text">{{ i18n.t('app.shop-never') }}</p>
      <p v-else-if="answer.badges.stop" class="text">
        {{ i18n.t(STOP_TEXT[answer.badges.stop]) }}
      </p>
      <template v-else>
        <p class="figure">
          <b>{{ badgeText(answer.badges.best.cost) }}</b>
          {{ i18n.t('app.shop-on-average') }}
        </p>
        <ShopSteps :steps="moveSteps(answer.badges.best.move, cards)" :cards />
        <dl v-if="badgeRows.length" class="rows">
          <template v-for="row in badgeRows" :key="row.label">
            <dt>{{ row.label }}</dt>
            <dd>
              <b>{{ row.figure }}</b>
              <ShopSteps :steps="row.steps" :cards />
            </dd>
          </template>
        </dl>
      </template>
    </section>

    <section v-if="answer.stopPlan" class="part">
      <p class="shop-label warn">{{ i18n.t('app.shop-stop') }}</p>
      <ShopSteps :steps="stopSteps(answer.stopPlan, cards)" :cards />
      <p class="shop-note">
        {{ i18n.t('app.shop-stop-plan-cost', { badges: badgeText(answer.stopPlan.cost) }) }}
      </p>
    </section>

    <p v-for="item in idle" :key="item" class="shop-note">
      {{ i18n.t('app.shop-idle-lock', { item }) }}
    </p>
  </article>
</template>

<style scoped>
.shop-answer {
  --disc-ring: rgba(255, 255, 255, 0.5);
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
  padding: 14px;
  border: 1px solid var(--import-border);
  border-radius: var(--radius-large);
  background: rgba(0, 0, 0, 0.22);
  color: var(--import-text);
}

header {
  display: flex;
  align-items: center;
  gap: 10px;
}

h3 {
  margin: 0;
  font-size: 15px;
  line-height: 1.3;
  font-weight: 700;
  color: var(--import-text);
}

h3 small {
  display: block;
  font-size: 12px;
  font-weight: 400;
  color: var(--import-text-dim);
}

.part {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 10px;
  border-top: 1px solid var(--import-border);
}

.shop-label.accent {
  color: var(--color-accent);
}

.shop-label.warn {
  color: var(--import-warn);
}

.retry {
  align-self: flex-start;
  margin-top: 2px;
}

.figure,
.text {
  margin: 0;
  font-size: 13px;
  color: var(--import-text-dim);
}

.text {
  color: var(--import-text);
}

.figure b {
  margin-right: 6px;
  font-size: 22px;
  line-height: 1.2;
  font-weight: 700;
  color: var(--import-text);
  font-variant-numeric: tabular-nums;
}

.rows {
  display: grid;
  gap: 2px;
  margin: 4px 0 0;
  font-size: 13px;
}

.rows dt {
  margin-top: 4px;
  color: var(--import-text-dim);
}

.rows dd {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
  margin: 0;
}

.rows dd b {
  font-variant-numeric: tabular-nums;
}
</style>

<script setup lang="ts">
/* The shop window as the game lays it out: its level, the price of a reroll,
   and the eight cards in two rows. Random fills it with an example shop of the
   level, and Clear empties it. Either takes a second press once anything is
   entered, since nothing entered can be brought back. */

import { computed } from 'vue'

import ShopBadges from './ShopBadges.vue'
import ShopWindowCard from './ShopWindowCard.vue'
import ConfirmLabel from '@/components/ui/ConfirmLabel.vue'
import { useArmedConfirm } from '@/composables/useArmedConfirm'
import { SHOP_FACTS } from '@/lib/hd/shop/goods'
import type { ShopProblem } from '@/lib/hd/shop/sources'
import type { ShopCard } from '@/lib/hd/shop/types'
import { useI18nStore } from '@/stores/i18n'
import { problemText } from './shopGoods'

const { cards, level, problems } = defineProps<{
  cards: readonly ShopCard[]
  level: number
  // Why the cards cannot come up at the level, if they cannot.
  problems: readonly ShopProblem[]
}>()

const emit = defineEmits<{
  pick: [card: number, under: DOMRect]
  lock: [card: number]
  lockedAt: [card: number, under: DOMRect]
  random: []
  clear: []
}>()

const i18n = useI18nStore()

const blank = computed(() => cards.every((card) => !card.good && !card.locked))

const wrong = computed(() => new Set(problems.flatMap((problem) => problem.cards)))
const why = computed(() =>
  problems.length
    ? [
        i18n.t('app.shop-impossible', { level }),
        ...problems.map((problem) => problemText(problem, level, i18n)),
      ]
    : [],
)

const { armed, confirm } = useArmedConfirm()
const random = (): void => {
  if (blank.value || confirm('random')) emit('random')
}
const clear = (): void => {
  if (confirm('clear')) emit('clear')
}
</script>

<template>
  <section class="sl-panel shop-box shop-window">
    <header class="head">
      <h2 class="shop-heading">
        {{ i18n.t('app.shop-window') }}
        <span class="level">{{ i18n.t('app.shop-level', { level }) }}</span>
      </h2>
      <span class="reroll">
        {{ i18n.t('app.shop-reroll') }}
        <ShopBadges :count="SHOP_FACTS.reroll" />
      </span>
      <span class="tools">
        <button
          type="button"
          class="shop-pill-button"
          :class="{ 'confirm-armed': armed === 'random' }"
          :title="i18n.t('app.shop-random-hint')"
          @click="random"
        >
          <ConfirmLabel :armed="armed === 'random'" :label="i18n.t('app.shop-random')" />
        </button>
        <button
          type="button"
          class="shop-pill-button"
          :class="{ 'confirm-armed': armed === 'clear' }"
          :title="i18n.t('app.shop-clear-hint')"
          :disabled="blank"
          @click="clear"
        >
          <ConfirmLabel :armed="armed === 'clear'" :label="i18n.t('app.clear')" />
        </button>
      </span>
    </header>
    <div class="cards">
      <ShopWindowCard
        v-for="(card, index) in cards"
        :key="index"
        :card
        :level
        :wrong="wrong.has(index)"
        @pick="(under) => emit('pick', index, under)"
        @locked-at="(under) => emit('lockedAt', index, under)"
        @lock="emit('lock', index)"
      />
    </div>
    <div v-if="why.length" class="why">
      <p v-for="line in why" :key="line" class="shop-note bad">{{ line }}</p>
    </div>
  </section>
</template>

<style scoped>
.head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 14px;
}

.level {
  padding: 1px 10px;
  border-radius: 999px;
  background: var(--color-header-gold);
  color: #222;
  font-size: 13px;
  font-weight: 700;
}

.reroll {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
  font-size: 13px;
  color: var(--import-text-dim);
}

.reroll :deep(.shop-badges) {
  color: var(--color-header-gold);
}

.tools {
  display: inline-flex;
  gap: 6px;
}

.cards {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 18px 14px;
  padding: 6px 6px 0 0;
}

@media (max-width: 520px) {
  .cards {
    gap: 16px 10px;
  }
}
</style>

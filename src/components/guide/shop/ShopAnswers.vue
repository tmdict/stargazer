<script setup lang="ts">
/* "What to do first": one card for each goal the wanted items make, and a
   line naming the goals the calculation left out as too large. */

import { computed } from 'vue'

import ShopAnswerCard from './ShopAnswerCard.vue'
import type { AnswerGoal, ShopAnswer, WantedHero } from '@/lib/hd/shop/calculate'
import type { Move, ShopCard } from '@/lib/hd/shop/types'
import { useI18nStore } from '@/stores/i18n'
import { goalName } from './shopGoods'

const { heroes, skipped } = defineProps<{
  answers: readonly ShopAnswer[]
  skipped: readonly AnswerGoal[]
  cards: readonly ShopCard[]
  basis: Move | null
  heroes: readonly WantedHero[]
  level: number
  badges: number
  working: boolean
}>()

const emit = defineEmits<{ recalculate: [move: Move] }>()

const i18n = useI18nStore()

const copiesOf = ({ goal }: ShopAnswer): number | undefined =>
  goal.kind === 'hero' ? heroes.find((hero) => hero.name === goal.name)?.copies : undefined

const keyOf = ({ goal }: ShopAnswer): string =>
  'name' in goal ? `${goal.kind}:${goal.name}` : goal.kind

const leftOut = computed(() =>
  new Intl.ListFormat(i18n.currentLocale, { type: 'conjunction' }).format(
    skipped.map((goal) => goalName(goal, i18n)),
  ),
)
</script>

<template>
  <section class="sl-panel shop-box">
    <h2 class="shop-heading">
      {{ i18n.t('app.shop-answers-head') }}
      <span class="shop-dim">{{ i18n.t('app.shop-answers-sub', { level, badges }) }}</span>
    </h2>
    <div class="cards">
      <ShopAnswerCard
        v-for="answer in answers"
        :key="keyOf(answer)"
        :answer
        :cards
        :basis
        :copies="copiesOf(answer)"
        :working
        @recalculate="emit('recalculate', $event)"
      />
    </div>
    <p v-if="answers.length" class="shop-note">{{ i18n.t('app.shop-answers-note') }}</p>
    <p v-if="skipped.length" class="shop-note">
      {{ i18n.t('app.shop-skipped', { goals: leftOut }) }}
    </p>
  </section>
</template>

<style scoped>
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  align-items: start;
  gap: 14px;
}

@media (max-width: 520px) {
  .cards {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>

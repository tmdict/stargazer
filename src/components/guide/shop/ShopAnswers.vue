<script setup lang="ts">
/* "What to do first": one card for each goal the wanted items make. */

import ShopAnswerCard from './ShopAnswerCard.vue'
import type { ShopAnswer, WantedHero } from '@/lib/hd/shop/calculate'
import type { ShopCard } from '@/lib/hd/shop/types'
import { useI18nStore } from '@/stores/i18n'

const { heroes } = defineProps<{
  answers: readonly ShopAnswer[]
  cards: readonly ShopCard[]
  heroes: readonly WantedHero[]
  level: number
  badges: number
  working: boolean
}>()

const i18n = useI18nStore()

const copiesOf = (answer: ShopAnswer): number | undefined =>
  answer.goal.kind === 'hero'
    ? heroes.find((hero) => hero.name === (answer.goal as { name: string }).name)?.copies
    : undefined

const keyOf = ({ goal }: ShopAnswer): string =>
  'name' in goal ? `${goal.kind}:${goal.name}` : goal.kind
</script>

<template>
  <section class="sl-panel shop-box shop-answers">
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
        :copies="copiesOf(answer)"
        :working
      />
    </div>
    <p class="shop-note">{{ i18n.t('app.shop-answers-note') }}</p>
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

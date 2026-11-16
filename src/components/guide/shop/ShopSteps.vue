<script setup lang="ts">
/* A move as a row of steps: buy a card, set or lift a lock, reroll, wait. */

import ShopBadges from './ShopBadges.vue'
import type { ShopCard } from '@/lib/hd/shop/types'
import { useI18nStore } from '@/stores/i18n'
import { cardLabel, type ShopStep } from './shopGoods'

const { cards } = defineProps<{ steps: readonly ShopStep[]; cards: readonly ShopCard[] }>()

const i18n = useI18nStore()

const text = (step: ShopStep): string => {
  if (step.kind === 'reroll') return i18n.t('app.shop-reroll')
  if (step.kind === 'wait') return i18n.t('app.shop-step-wait')
  const card = cards[step.card ?? -1]
  return i18n.t(`app.shop-step-${step.kind}`, {
    item: card ? cardLabel(card, i18n.currentLocale) : '',
  })
}
</script>

<template>
  <span class="shop-steps">
    <span v-for="(step, index) in steps" :key="index" class="step" :class="step.kind">
      {{ text(step) }}
      <ShopBadges v-if="step.price !== undefined" :count="step.price" />
    </span>
  </span>
</template>

<style scoped>
.shop-steps {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.step {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 10px;
  border: 1px solid var(--import-border);
  border-radius: 999px;
  background: var(--import-surface);
  font-size: 13px;
  font-weight: 600;
  line-height: 1.5;
}

.step :deep(.shop-badges) {
  color: var(--color-header-gold);
}
</style>

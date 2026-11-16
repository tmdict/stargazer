<script setup lang="ts">
/* The shop window as the game lays it out: its level, the price of a reroll,
   and the eight cards in two rows. */

import ShopBadges from './ShopBadges.vue'
import ShopWindowCard from './ShopWindowCard.vue'
import { SHOP_FACTS } from '@/lib/hd/shop/goods'
import type { ShopCard } from '@/lib/hd/shop/types'
import { useI18nStore } from '@/stores/i18n'

defineProps<{
  cards: readonly ShopCard[]
  level: number
  // Whether the shop level goes up next round.
  rises: boolean
}>()

const emit = defineEmits<{ pick: [card: number, under: DOMRect]; lock: [card: number] }>()

const i18n = useI18nStore()
</script>

<template>
  <section class="sl-panel shop-box shop-window">
    <header class="head">
      <h2 class="shop-heading">
        {{ i18n.t('app.shop-window') }}
        <span class="level">{{ i18n.t('app.shop-level', { level }) }}</span>
      </h2>
      <span v-if="rises" class="shop-dim">{{ i18n.t('app.shop-level-rises') }}</span>
      <span class="reroll">
        {{ i18n.t('app.shop-reroll') }}
        <ShopBadges :count="SHOP_FACTS.reroll" />
      </span>
    </header>
    <div class="cards">
      <ShopWindowCard
        v-for="(card, index) in cards"
        :key="index"
        :card
        @pick="(under) => emit('pick', index, under)"
        @lock="emit('lock', index)"
      />
    </div>
    <p class="shop-note">{{ i18n.t('app.shop-window-hint') }}</p>
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

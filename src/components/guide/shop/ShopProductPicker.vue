<script setup lang="ts">
/* The popup that sets what a shop card shows: one of the shop's products or
   nothing, then, for a hero card or an equipment card, which hero or piece it
   is. Naming the hero or piece is optional, since a card that is not one
   looked for needs no name. A product is set as soon as it is picked, so the
   popup can be left at any step. */

import { computed, ref } from 'vue'

import ShopBadges from './ShopBadges.vue'
import ShopEquipmentList from './ShopEquipmentList.vue'
import ShopGoodArt from './ShopGoodArt.vue'
import CharacterSelectionPalette from '@/components/CharacterSelectionPalette.vue'
import { SHOP_FACTS } from '@/lib/hd/shop/goods'
import type { Good, ShopCard } from '@/lib/hd/shop/types'
import type { CharacterType } from '@/lib/types/character'
import { useI18nStore } from '@/stores/i18n'
import { goodName, SHOP_GOODS } from './shopGoods'

const { card } = defineProps<{
  card: ShopCard
  // The heroes a hero card can show.
  heroes: readonly CharacterType[]
}>()

const emit = defineEmits<{ set: [card: ShopCard]; close: [] }>()

const i18n = useI18nStore()

const step = ref<'product' | 'hero' | 'piece'>('product')
const good = computed(() => SHOP_GOODS.get(card.good ?? ''))

const choose = (picked: Good): void => {
  emit('set', { good: picked.name, locked: card.locked, bought: false })
  if (picked.kind === 'hero') step.value = 'hero'
  else if (picked.kind === 'equipment') step.value = 'piece'
  else emit('close')
}

const empty = (): void => {
  emit('set', { good: null, locked: card.locked, bought: false })
  emit('close')
}

// A bought card keeps no lock.
const toggleBought = (): void =>
  emit('set', { ...card, bought: !card.bought, locked: card.bought && card.locked })

const name = (named: Pick<ShopCard, 'hero' | 'equipment'>): void => {
  emit('set', { good: card.good, locked: card.locked, bought: card.bought, ...named })
  emit('close')
}
</script>

<template>
  <div v-if="step === 'product'" class="shop-popup">
    <div class="goods">
      <button
        v-for="one in SHOP_FACTS.goods"
        :key="one.name"
        type="button"
        class="good"
        :class="{ on: one.name === card.good }"
        @click="choose(one)"
      >
        <span class="art"><ShopGoodArt :good="one" /></span>
        <span class="label">{{ goodName(one.name, i18n.currentLocale) }}</span>
        <ShopBadges class="price" :count="one.price" />
      </button>
    </div>
    <div class="foot">
      <button type="button" class="shop-popup-button" @click="empty">
        {{ i18n.t('app.shop-picker-empty') }}
      </button>
      <button
        v-if="good"
        type="button"
        class="shop-popup-button"
        :aria-pressed="card.bought"
        @click="toggleBought"
      >
        {{ i18n.t('app.shop-picker-bought') }}
      </button>
    </div>
  </div>
  <div v-else class="shop-popup">
    <p class="shop-popup-title">
      {{ i18n.t(step === 'hero' ? 'app.shop-picker-which-hero' : 'app.shop-picker-which-piece') }}
      <button type="button" class="shop-popup-button" @click="emit('close')">
        {{ i18n.t('app.shop-picker-skip') }}
      </button>
    </p>
    <CharacterSelectionPalette
      v-if="step === 'hero'"
      :characters="heroes"
      :enter-hint="i18n.t('app.shop-picker-which-hero')"
      @pick="(hero) => name({ hero: hero.name })"
    />
    <ShopEquipmentList v-else :tier="good?.tier" @pick="(piece) => name({ equipment: piece })" />
  </div>
</template>

<style scoped>
.goods {
  flex: none;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
}

.good {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.07);
  color: #fff;
  font: inherit;
  text-align: left;
  cursor: pointer;
}

.good:hover {
  background: rgba(255, 255, 255, 0.14);
}

.good.on {
  border-color: var(--color-accent);
}

.art {
  flex: none;
  display: block;
  border-radius: 6px 6px 0 0;
}

.label {
  flex: none;
  box-sizing: content-box;
  height: 3.6em;
  padding: 3px 4px 0;
  overflow: hidden;
  font-size: 10.5px;
  line-height: 1.2;
}

.price {
  padding: 1px 4px 4px;
  font-size: 12px;
  color: var(--color-header-gold);
}

.foot {
  flex: none;
  display: flex;
  justify-content: space-between;
  gap: 8px;
}
</style>

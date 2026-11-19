<script setup lang="ts">
/* One of the shop's eight cards: its product's picture, name and price, and
   its lock. A press on the card opens the picker that sets what it shows; a
   bought card is dimmed. A locked card names the shop level it was locked at
   wherever that could be a lower one than the shop's, and a press on the name
   offers the levels. */

import { computed } from 'vue'

import ShopBadges from './ShopBadges.vue'
import ShopGoodArt from './ShopGoodArt.vue'
import IconLock from '@/components/ui/IconLock.vue'
import IconPlus from '@/components/ui/IconPlus.vue'
import type { ShopCard } from '@/lib/hd/shop/types'
import { useI18nStore } from '@/stores/i18n'
import { cardName, lockedLevel, lockLevels, SHOP_GOODS } from './shopGoods'

const { card, level } = defineProps<{ card: ShopCard; level: number }>()

const emit = defineEmits<{ pick: [under: DOMRect]; lock: []; lockedAt: [under: DOMRect] }>()

const i18n = useI18nStore()

const good = computed(() => SHOP_GOODS.get(card.good ?? ''))
const label = computed(() => cardName(card, i18n))
const spoken = computed(() =>
  [
    label.value,
    good.value && `${good.value.price} ${i18n.t('app.shop-badges')}`,
    card.bought && i18n.t('app.shop-picker-bought'),
  ]
    .filter(Boolean)
    .join(', '),
)

const levels = computed(() => lockLevels(card, level))
const lockedAt = computed(() => lockedLevel(card, level))
const lower = computed(() => card.locked && (levels.value.length > 1 || lockedAt.value < level))

const under = (event: MouseEvent): DOMRect =>
  (event.currentTarget as HTMLElement).getBoundingClientRect()
</script>

<template>
  <div class="shop-card" :class="{ bought: card.bought, locked: card.locked }">
    <button type="button" class="face" :aria-label="spoken" @click="emit('pick', under($event))">
      <span class="art">
        <ShopGoodArt v-if="good" :good :hero="card.hero" :equipment="card.equipment" />
        <span v-else class="empty"><IconPlus /></span>
      </span>
      <span class="name">{{ good ? label : '' }}</span>
      <ShopBadges v-if="good" class="price" :count="good.price" />
    </button>
    <button
      v-if="lower"
      type="button"
      class="locked-at"
      :disabled="levels.length < 2"
      :aria-label="i18n.t('app.shop-locked-at', { level: lockedAt })"
      :title="i18n.t('app.shop-locked-at', { level: lockedAt })"
      @click="emit('lockedAt', under($event))"
    >
      {{ i18n.t('app.shop-level', { level: lockedAt }) }}
    </button>
    <button
      v-if="!card.bought"
      type="button"
      class="lock"
      :aria-pressed="card.locked"
      :aria-label="i18n.t(card.locked ? 'app.shop-unlock' : 'app.shop-lock')"
      :title="i18n.t(card.locked ? 'app.shop-unlock' : 'app.shop-lock')"
      @click="emit('lock')"
    >
      <IconLock :open="!card.locked" />
    </button>
  </div>
</template>

<style scoped>
.shop-card {
  position: relative;
  min-width: 0;
}

.face {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 8px;
  background: var(--import-surface);
  color: var(--import-text);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background-color var(--transition-fast);
}

.face:hover {
  background: var(--import-surface-hover);
}

.face:focus-visible,
.lock:focus-visible,
.locked-at:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.locked .face {
  border-color: var(--color-header-gold);
}

.art {
  flex: none;
  display: block;
  width: 100%;
  aspect-ratio: 1;
  border-radius: 7px 7px 0 0;
}

.empty {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  border-radius: inherit;
  background: rgba(0, 0, 0, 0.22);
  color: var(--import-text-dim);
  font-size: 22px;
}

.name {
  flex: none;
  box-sizing: content-box;
  height: 2.6em;
  padding: 5px 6px 0;
  overflow: hidden;
  font-size: 12px;
  line-height: 1.3;
}

.price {
  flex: none;
  min-height: 1.4em;
  padding: 2px 6px 6px;
  font-size: 14px;
  color: var(--color-header-gold);
}

.bought .art,
.bought .name,
.bought .price {
  opacity: 0.35;
}

.lock {
  position: absolute;
  top: -8px;
  right: -8px;
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid var(--import-border-strong);
  border-radius: 50%;
  background: #1b1e24;
  color: var(--import-text-dim);
  font-size: 14px;
  cursor: pointer;
}

.lock:hover {
  color: var(--import-text);
  border-color: var(--import-text);
}

.locked .lock {
  border-color: var(--color-header-gold);
  background: var(--color-header-gold);
  color: #222;
}

.locked-at {
  position: absolute;
  top: -8px;
  left: -6px;
  height: 22px;
  padding: 0 8px;
  border: 1px solid var(--color-header-gold);
  border-radius: 999px;
  background: #1b1e24;
  color: var(--color-header-gold);
  font: inherit;
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
}

.locked-at:hover:not(:disabled) {
  background: var(--color-header-gold);
  color: #222;
}

.locked-at:disabled {
  cursor: default;
}

@media (max-width: 520px) {
  .name {
    height: 3.9em;
  }
}
</style>

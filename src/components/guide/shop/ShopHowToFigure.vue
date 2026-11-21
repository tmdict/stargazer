<script setup lang="ts">
/* A picture of an answer card for the how-to, beside its key: the page's own
   card with an example answer, its words drawn as rune shapes and numbered
   marks on its parts. The key is the numbered list in the slot, one item per
   mark, and the stop example's marks go on from the move example's six. The
   marks sit on the card's own elements, so a change to its layout needs them
   checked. Both answers come from one calculation on the measured table.
   The popup's reading styles are turned back to the page's inside the
   picture: its typeface, and paragraphs at full opacity with the line height
   base.css gives them. */

import ShopAnswerCard from './ShopAnswerCard.vue'
import RunePicture from '@/components/ui/RunePicture.vue'
import type { ShopAnswer } from '@/lib/hd/shop/calculate'
import type { ShopCard } from '@/lib/hd/shop/types'

const { example } = defineProps<{ example: 'move' | 'stop' }>()

const at = (value: number) => ({ floor: value, ceiling: value })
const card = (good: string, extra: Partial<ShopCard> = {}): ShopCard => ({
  good,
  locked: false,
  bought: false,
  ...extra,
})

// A level 3 shop and 57 badges, two more copies of Valen wanted, with an
// unwanted hero card locked.
const MOVE: { cards: ShopCard[]; answer: ShopAnswer } = {
  cards: [card('hero', { hero: 'cassadee', locked: true }), card('lightbearer-pack')],
  answer: {
    goal: { kind: 'hero', name: 'valen' },
    chance: {
      best: { move: { kind: 'reroll', locks: [1] }, chance: at(0.324) },
      certain: true,
      keepLocks: null,
      current: { move: { kind: 'reroll', locks: [0] }, chance: at(0.313) },
      offers: { chance: 0.043, first: 1 },
    },
    badges: {
      best: { move: { kind: 'reroll', locks: [] }, cost: at(79.2) },
      next: { move: { kind: 'buy', card: 1 }, cost: at(97.6) },
      keepLocks: null,
      stop: null,
    },
    stopPlan: null,
    idleLocks: [],
  },
}

// A level 2 shop that levels up next round and 53 badges, two more copies of
// Cecia wanted.
const STOP: { cards: ShopCard[]; answer: ShopAnswer } = {
  cards: [card('hero', { hero: 'cecia' })],
  answer: {
    goal: { kind: 'hero', name: 'cecia' },
    chance: {
      best: { move: { kind: 'buy', card: 0 }, chance: at(0.454) },
      certain: true,
      keepLocks: null,
      current: { move: { kind: 'reroll', locks: [] }, chance: at(0.139) },
      offers: { chance: 0.091, first: 0 },
    },
    badges: {
      best: { move: { kind: 'buy', card: 0 }, cost: at(66.8) },
      next: { move: { kind: 'reroll', locks: [0] }, cost: at(67.7) },
      keepLocks: null,
      stop: 'next-level',
    },
    stopPlan: { locks: [], buy: 0, cost: at(52.2) },
    idleLocks: [],
  },
}

const shown = example === 'move' ? MOVE : STOP
</script>

<template>
  <div class="shop-how-figure" :class="example">
    <RunePicture class="picture" aria-hidden="true" inert>
      <div class="shop-page" data-theme="dark">
        <div class="shop-text">
          <ShopAnswerCard
            :answer="shown.answer"
            :cards="shown.cards"
            :basis="null"
            :copies="2"
            :working="false"
          />
        </div>
      </div>
    </RunePicture>
    <div class="key">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.shop-how-figure {
  display: grid;
  grid-template-columns: minmax(0, 380px) minmax(0, 1fr);
  align-items: start;
  gap: 8px 28px;
  margin: 16px 0 8px;
}

.picture {
  --reading-text-opacity: 1;
  --reading-leading: 1.6;
  padding: 14px 14px 14px 40px;
  font-family: var(--font-ui);
  border-radius: var(--radius-large);
  background: var(--reading-picture);
}

.picture :deep(:is(.shop-answer > header, .part > *)) {
  position: relative;
}

.picture :deep(:is(.shop-answer > header, .part > *)::before),
.key :deep(ol > li)::before {
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--color-accent-active);
  color: #fff;
  font-size: 11px;
  line-height: 1;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.picture :deep(:is(.shop-answer > header, .part > *)::before) {
  content: var(--mark, none);
  position: absolute;
  top: 2px;
  left: -45px;
}

.picture :deep(.shop-answer > header)::before {
  top: 12px;
}

.move :deep(.shop-answer > header) {
  --mark: '1';
}

.move :deep(.part:nth-of-type(1) > .figure) {
  --mark: '2';
}

.move :deep(.part > .shop-steps) {
  --mark: '3';
}

.move :deep(.part > .rows) {
  --mark: '4';
}

.move :deep(.part > .retry) {
  --mark: '5';
}

.move :deep(.part:nth-of-type(2) > .figure) {
  --mark: '6';
}

.stop :deep(.part:nth-of-type(2) > .text) {
  --mark: '7';
}

.stop :deep(.part:nth-of-type(3) > .shop-steps) {
  --mark: '8';
}

.stop :deep(.part:nth-of-type(3) > .shop-note) {
  --mark: '9';
}

.key :deep(ol) {
  margin: 0;
  padding: 0;
  list-style: none;
  counter-reset: mark;
}

.stop .key :deep(ol) {
  counter-reset: mark 6;
}

.key :deep(ol > li) {
  counter-increment: mark;
  position: relative;
  margin: 0 0 10px;
  padding-left: 30px;
}

.key :deep(ol > li)::before {
  content: counter(mark);
  position: absolute;
  top: 2px;
  left: 0;
}

@media (max-width: 760px) {
  .shop-how-figure {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>

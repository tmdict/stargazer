<script setup lang="ts">
/* A number of badges beside the game's badge coin, or a gold dot where the
   data pack holds no picture of it. */

import { shopPicture } from './shopGoods'

defineProps<{ count: number | string }>()

const coin = shopPicture('badge')
</script>

<template>
  <span class="shop-badges">
    <img v-if="coin" class="coin" :src="coin" alt="" draggable="false" />
    <span v-else class="coin dot" />
    {{ count }}
  </span>
</template>

<style scoped>
.shop-badges {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
  white-space: nowrap;
}

.coin {
  flex: none;
  width: 1.15em;
  height: 1.15em;
  object-fit: contain;
}

.coin.dot {
  width: 0.7em;
  height: 0.7em;
  border-radius: 50%;
  background: var(--color-header-gold);
}
</style>

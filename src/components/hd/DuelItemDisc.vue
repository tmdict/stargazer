<script setup lang="ts">
/* An Honor Duel item as a round picture: a piece of equipment on its tier's
   backdrop, the way a hero's portrait sits on its own (GuidePortrait), and an
   artifact on the plain one. */

import { computed } from 'vue'

import GuideDisc from '@/components/guide/GuideDisc.vue'
import { duelItemImage } from '@/lib/hd/catalog'
import type { HonorDuelItem } from '@/lib/types/honorDuel'
import { tierBackdrop } from '@/utils/tierBackdrop'

const { item } = defineProps<{ item: HonorDuelItem; size?: number }>()

const image = computed(() => duelItemImage(item))
const backdrop = computed(() =>
  item.kind === 'equipment' ? tierBackdrop(item.item.tier) : undefined,
)
</script>

<template>
  <GuideDisc :size :backdrop>
    <span class="picture">
      <img v-if="image" :src="image" alt="" loading="lazy" draggable="false" />
    </span>
  </GuideDisc>
</template>

<style scoped>
.picture {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
}

.picture img {
  width: 92%;
  height: 92%;
  object-fit: contain;
}
</style>

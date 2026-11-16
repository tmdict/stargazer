<script setup lang="ts">
/* A piece of Honor Duel equipment as a round picture on its tier's backdrop,
   the way a hero's portrait sits on its own (GuidePortrait). */

import { computed } from 'vue'

import GuideDisc from '@/components/guide/GuideDisc.vue'
import { duelEquipment, duelItemImage } from '@/lib/hd/catalog'
import type { EquipmentTier } from '@/lib/types/honorDuel'
import { useGameDataStore } from '@/stores/gameData'

const { name } = defineProps<{ name: string; size?: number }>()

const gameData = useGameDataStore()

// Legendary has no backdrop picture and takes a plain fill in its colour.
const BACKDROPS: Partial<Record<EquipmentTier, string>> = {
  rare: 'bg-rare',
  elite: 'bg-a',
  epic: 'bg-s',
}

const item = computed(() => duelEquipment.find((piece) => piece.name === name))
const image = computed(() => item.value && duelItemImage({ kind: 'equipment', item: item.value }))
const backdrop = computed(() => {
  const icon = item.value && BACKDROPS[item.value.tier]
  return icon ? gameData.getIcon(icon) : undefined
})
</script>

<template>
  <GuideDisc class="shop-piece-disc" :class="item && `shop-tier-${item.tier}`" :size :backdrop>
    <span class="picture">
      <img v-if="image" :src="image" alt="" loading="lazy" draggable="false" />
    </span>
  </GuideDisc>
</template>

<style scoped>
.shop-piece-disc {
  background-color: var(--shop-tier);
}

.picture {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
}

.picture img {
  width: 82%;
  height: 82%;
  object-fit: contain;
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.45));
}
</style>

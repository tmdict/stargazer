<script setup lang="ts">
/* A piece of Honor Duel equipment as a round picture on its tier's backdrop,
   the way a hero's portrait sits on its own (GuidePortrait). */

import { computed } from 'vue'

import GuideDisc from '@/components/guide/GuideDisc.vue'
import { duelEquipment, duelItemImage } from '@/lib/hd/catalog'
import { tierBackdrop } from '@/utils/tierBackdrop'

const { name } = defineProps<{ name: string; size?: number }>()

const item = computed(() => duelEquipment.find((piece) => piece.name === name))
const image = computed(() => item.value && duelItemImage({ kind: 'equipment', item: item.value }))
const backdrop = computed(() => item.value && tierBackdrop(item.value.tier))
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

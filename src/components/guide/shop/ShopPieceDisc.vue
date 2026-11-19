<script setup lang="ts">
/* A piece of Honor Duel equipment, by the name a shop card holds, as a round
   picture on its tier's backdrop. A name that is no piece's draws the bare
   disc. */

import { computed } from 'vue'

import GuideDisc from '@/components/guide/GuideDisc.vue'
import DuelItemDisc from '@/components/hd/DuelItemDisc.vue'
import { duelEquipment } from '@/utils/duelCatalog'

const { name } = defineProps<{ name: string; size?: number }>()

const item = computed(() => duelEquipment.find((piece) => piece.name === name))
</script>

<template>
  <DuelItemDisc v-if="item" :item="{ kind: 'equipment', item }" :size />
  <GuideDisc v-else :size />
</template>

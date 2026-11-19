<script setup lang="ts">
/* The equipment picker of an Honor Duel board: the shop calculator's list with
   every piece of the mode, and None first to take a held piece off. */

import ShopEquipmentList from '@/components/guide/shop/ShopEquipmentList.vue'
import ShopPickerPopup from '@/components/guide/shop/ShopPickerPopup.vue'
import ShopPopupClose from '@/components/guide/shop/ShopPopupClose.vue'
import type { Point } from '@/lib/layout'
import { useI18nStore } from '@/stores/i18n'
import { duelEquipment } from '@/utils/duelCatalog'
import { gameLabel } from '@/utils/skillLabels'

import '@/components/guide/shop/shop.css'

defineProps<{
  position: Point
  // Whether the hero holds a piece to take off.
  clearable: boolean
}>()

// The id of the piece picked, or 0 for none.
const emit = defineEmits<{ pick: [id: number]; close: [] }>()

const i18n = useI18nStore()

const pick = (name: string): void => {
  const piece = duelEquipment.find((one) => one.name === name)
  if (piece) emit('pick', piece.id)
}
</script>

<template>
  <ShopPickerPopup
    :label="gameLabel('equipment', i18n.currentLocale)"
    :position
    @close="emit('close')"
  >
    <div class="shop-popup">
      <ShopPopupClose @close="emit('close')" />
      <ShopEquipmentList all :clearable @pick="pick" @clear="emit('pick', 0)" />
    </div>
  </ShopPickerPopup>
</template>

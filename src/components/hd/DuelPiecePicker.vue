<script lang="ts">
import type { Point } from '@/lib/layout'
import type { Team } from '@/lib/types/team'

// The unit an equipment pick is for, and where its picker opens.
export interface DuelPiecePick {
  team: Team
  unitId: number
  position: Point
}
</script>

<script setup lang="ts">
/* Opens the equipment popup for a unit on an Honor Duel board, for every place
   that offers one: open while its model names a unit, and a pick goes to the
   unit and its copies. The popup is fetched the first time one opens. */

import { watch } from 'vue'

import { useSelectionState } from '@/composables/useSelectionState'
import { DUEL_ATTR_EQUIPMENT } from '@/lib/hd/board'
import { setDuelEquipment } from '@/stores/duelBoard'
import type { GridContext } from '@/stores/gridContext'
import { defineLazyComponent } from '@/utils/lazyComponent'

const { context } = defineProps<{ context: GridContext }>()

const picking = defineModel<DuelPiecePick | null>({ required: true })

const DuelEquipmentPopup = defineLazyComponent(() => import('./DuelEquipmentPopup.vue'))

const { clearLiftedHex } = useSelectionState()

// The popup closes on a tap outside it, and on the board that tap would also
// move a unit still lifted.
watch(picking, (unit) => {
  if (unit) clearLiftedHex()
})

// The unit can leave its side under an open popup, by a drag or a board swap.
watch(
  () => context.placements,
  () => (picking.value = null),
)

const pick = (piece: number): void => {
  const unit = picking.value
  if (unit) setDuelEquipment(context, unit.team, unit.unitId, piece)
  picking.value = null
}
</script>

<template>
  <DuelEquipmentPopup
    v-if="picking"
    :position="picking.position"
    :clearable="context.getAttr(picking.team, picking.unitId, DUEL_ATTR_EQUIPMENT) !== 0"
    @pick="pick"
    @close="picking = null"
  />
</template>

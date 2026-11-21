/* Honor Duel's maps and the one the board is on, for the board's two map
 * controls: the strip of buttons and the tab row's menu. */

import { computed } from 'vue'

import { useSelectionState } from '@/composables/useSelectionState'
import { DUEL_MAP_NAMES } from '@/lib/hd/maps'
import { useDuelBoard } from '@/stores/duelBoard'
import { useGrids } from '@/stores/grids'

export function useDuelMapSlots() {
  const grids = useGrids()
  const duelBoard = useDuelBoard()
  const { clearTargetHex } = useSelectionState()

  const held = computed(() => DUEL_MAP_NAMES.find(({ key }) => key === grids.active?.currentMap))

  // A tile tapped before may be another side's on the new map, or hold a unit.
  const select = (map: string): void => {
    if (duelBoard.moveToMap(map)) clearTargetHex()
  }

  return { slots: DUEL_MAP_NAMES, held, select }
}

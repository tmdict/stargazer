/* The steps a hero picker's click shares, on the Heroes tab and the Honor Duel
 * tab alike: a tapped tile takes the pick, and otherwise the pick goes to the
 * first side with room. Whether a click on a placed hero takes it off is each
 * picker's own rule. */

import { useSelectionState } from '@/composables/useSelectionState'
import type { Team } from '@/lib/types/team'
import { useGrids } from '@/stores/grids'

export function usePickerPlacement() {
  const { fillOrder, targetHexId, targetTile, clearTargetHex } = useSelectionState()
  const grids = useGrids()

  // Placement, uniqueness, and removal are page-wide (across every board); on
  // a single board this is identical to a per-board check. A hero is "placed"
  // if it sits on either team, so a click toggle finds it wherever it is.
  const placedTeam = (characterId: number): Team | null =>
    fillOrder.find((team) => grids.findPlacement(characterId, team) !== null) ?? null

  // Mobile: a tapped tile targets a specific cell on its board. The hero goes
  // there with that tile's team, on that board (not whichever board is
  // active). True when the click was such a pick, placed or not.
  const placeOnTarget = (characterId: number): boolean => {
    if (targetHexId.value === null) return false
    const tile = targetTile.value
    if (tile) grids.placePick(tile.ctx, characterId, tile.team, tile.hexId)
    clearTargetHex()
    return true
  }

  const placeOnFirstSide = (characterId: number): void => {
    for (const team of fillOrder) {
      if (grids.placeOnActive(characterId, team)) break
    }
  }

  return { targetTile, clearTargetHex, placedTeam, placeOnTarget, placeOnFirstSide }
}

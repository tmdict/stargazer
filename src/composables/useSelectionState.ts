import { ref, watch } from 'vue'

import { getCharacter } from '@/lib/characters/character'
import { Team } from '@/lib/types/team'
import { useArtifactStore } from '@/stores/artifact'
import { useCharacterStore } from '@/stores/character'
import { useGrids } from '@/stores/grids'

// Mobile: the team whose artifact slot a tapped on-grid artifact cell targets, so
// the seasonal sheet's pick lands on that cell's side instead of the default fill.
// Board-qualified (gridId) so the pick lands on the tapped board, not whichever
// board is active by the time the sheet pick happens.
const targetArtifactTeam = ref<Team | null>(null)
const targetArtifactGridId = ref<number | null>(null)

// Mobile: the grid cell a tapped roster character should fill. Board-qualified
// (gridId) so only the tapped board highlights it: every board shares the same
// hex ids. Set by tapping an empty tile (GridManager), read + cleared by the roster.
const targetHexId = ref<number | null>(null)
const targetGridId = ref<number | null>(null)

// The grid cell of a placed hero "lifted" for moving (tap a hero to lift, tap an
// empty cell to drop, same or another board). Board-qualified so a lift stays
// scoped to its board, and unit-qualified so useLiftGuard can tell "still the
// lifted hero" from "removed, or replaced by a hero the user never lifted".
const liftedHexId = ref<number | null>(null)
const liftedGridId = ref<number | null>(null)
const liftedCharacterId = ref<number | null>(null)

const setLiftedHex = (hexId: number, gridId: number, characterId: number) => {
  liftedHexId.value = hexId
  liftedGridId.value = gridId
  liftedCharacterId.value = characterId
}

const clearLiftedHex = () => {
  liftedHexId.value = null
  liftedGridId.value = null
  liftedCharacterId.value = null
}

/* Gesture handlers clear the lift on taps and drags, but placements also change
 * under it programmatically (roster remove, map switch, board swap, phantimal
 * reconciliation, companion cascade). Installed once at the app root, this
 * watcher drops the lift as soon as its cell stops holding the lifted unit, so
 * a stale lift can never eat a tap or move a hero the user didn't lift. */
export function useLiftGuard(): void {
  const grids = useGrids()
  watch(
    () => {
      if (liftedHexId.value === null || liftedGridId.value === null) return true
      const ctx = grids.getContext(liftedGridId.value)
      return (
        ctx !== undefined && getCharacter(ctx.grid, liftedHexId.value) === liftedCharacterId.value
      )
    },
    (liftIntact) => {
      if (!liftIntact) clearLiftedHex()
    },
  )
}

// Mobile: a deep component asking HomeView to open the roster sheet on a given
// tab (e.g. an on-grid artifact cell → Seasonal tab). A fresh object per call so
// repeated requests for the same tab still fire the watcher.
const tabRequest = ref<{ tab: string } | null>(null)

export function useSelectionState() {
  const characterStore = useCharacterStore()
  const artifactStore = useArtifactStore()
  const grids = useGrids()

  // Click-to-add fills the ally side first, then the enemy side.
  const fillOrder: Team[] = [Team.ALLY, Team.ENEMY]

  const setArtifactTarget = (team: Team, gridId: number) => {
    targetArtifactTeam.value = team
    targetArtifactGridId.value = gridId
  }

  const clearArtifactTarget = () => {
    targetArtifactTeam.value = null
    targetArtifactGridId.value = null
  }

  // Clears every board (the single Arena board, or all five in 5 v 5).
  const handleClearAll = () => {
    grids.clearAll()
    targetHexId.value = null
    targetGridId.value = null
    clearLiftedHex()
    targetArtifactTeam.value = null
    targetArtifactGridId.value = null
  }

  const setTargetHex = (hexId: number, gridId: number) => {
    targetHexId.value = hexId
    targetGridId.value = gridId
  }

  const clearTargetHex = () => {
    targetHexId.value = null
    targetGridId.value = null
  }

  // Sheet dismissed without a pick: drop both pending click-to-place targets.
  const clearTargets = () => {
    clearTargetHex()
    clearArtifactTarget()
  }

  const requestTab = (tab: string) => {
    tabRequest.value = { tab }
  }

  return {
    targetArtifactTeam,
    targetArtifactGridId,
    fillOrder,
    targetHexId,
    targetGridId,
    liftedHexId,
    liftedGridId,
    tabRequest,
    characterStore,
    artifactStore,
    setArtifactTarget,
    clearArtifactTarget,
    handleClearAll,
    setTargetHex,
    clearTargetHex,
    clearTargets,
    setLiftedHex,
    clearLiftedHex,
    requestTab,
  }
}

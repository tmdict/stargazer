import { computed, ref } from 'vue'

import { Team } from '@/lib/types/team'
import { useArtifactStore } from '@/stores/artifact'
import { useCharacterStore } from '@/stores/character'
import { useGrids } from '@/stores/grids'
import { invertTeam } from '@/utils/tileStateFormatting'

// Mobile: the team whose artifact slot a tapped on-grid artifact cell targets, so
// the seasonal sheet's pick lands on that cell's side instead of the default fill.
const targetArtifactTeam = ref<Team | null>(null)

// Mobile: the grid cell a tapped roster character should fill. Board-qualified
// (gridId) so only the tapped board highlights it: every board shares the same
// hex ids. Set by tapping an empty tile (GridManager), read + cleared by the roster.
const targetHexId = ref<number | null>(null)
const targetGridId = ref<number | null>(null)

// Mobile: the grid cell of a placed hero "lifted" for moving (tap a hero to lift,
// tap an empty cell on the same board to drop). Board-qualified so a lift stays
// scoped to its board. Set/cleared by GridCharacters + GridManager.
const liftedHexId = ref<number | null>(null)
const liftedGridId = ref<number | null>(null)

// Mobile: a deep component asking HomeView to open the roster sheet on a given
// tab (e.g. an on-grid artifact cell → Seasonal tab). A fresh object per call so
// repeated requests for the same tab still fire the watcher.
const tabRequest = ref<{ tab: string } | null>(null)

export function useSelectionState() {
  const characterStore = useCharacterStore()
  const artifactStore = useArtifactStore()
  const grids = useGrids()

  // Click-to-add fills the displayed-ally side first, then the displayed enemy
  // side (invert-aware). Engine teams in that priority order.
  const fillOrder = computed<Team[]>(() => [
    invertTeam(Team.ALLY, grids.inverted),
    invertTeam(Team.ENEMY, grids.inverted),
  ])

  const setArtifactTarget = (team: Team) => {
    targetArtifactTeam.value = team
  }

  const clearArtifactTarget = () => {
    targetArtifactTeam.value = null
  }

  // Clears every board (the single Arena board, or all five in 5 v 5).
  const handleClearAll = () => {
    grids.clearAll()
    targetHexId.value = null
    targetGridId.value = null
    liftedHexId.value = null
    liftedGridId.value = null
    targetArtifactTeam.value = null
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

  const setLiftedHex = (hexId: number, gridId: number) => {
    liftedHexId.value = hexId
    liftedGridId.value = gridId
  }

  const clearLiftedHex = () => {
    liftedHexId.value = null
    liftedGridId.value = null
  }

  const requestTab = (tab: string) => {
    tabRequest.value = { tab }
  }

  return {
    targetArtifactTeam,
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

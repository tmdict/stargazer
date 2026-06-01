import { ref } from 'vue'

import { Team } from '@/lib/types/team'
import { useArtifactStore } from '@/stores/artifact'
import { useCharacterStore } from '@/stores/character'

// Shared state across all components
const selectedTeam = ref<Team>(Team.ALLY)

// Mobile: the grid cell a tapped roster character should fill. Set by tapping
// an empty tile (GridManager), read + cleared by the roster (CharacterSelection).
const targetHexId = ref<number | null>(null)

// Mobile: the grid cell of a placed hero that's been "lifted" for moving (tap a
// hero to lift, tap an empty cell to drop). Set/cleared by GridCharacters +
// GridManager; highlighted by GridTiles.
const liftedHexId = ref<number | null>(null)

// Mobile: a deep component asking HomeView to open the roster sheet on a given
// tab (e.g. an on-grid artifact cell → Seasonal tab). A fresh object per call so
// repeated requests for the same tab still fire the watcher.
const tabRequest = ref<{ tab: string } | null>(null)

export function useSelectionState() {
  const characterStore = useCharacterStore()
  const artifactStore = useArtifactStore()

  const handleTeamChange = (team: Team) => {
    selectedTeam.value = team
  }

  const handleClearAll = () => {
    characterStore.clearAllCharacters()
    artifactStore.clearAllArtifacts()
    targetHexId.value = null
    liftedHexId.value = null
  }

  const setTargetHex = (hexId: number) => {
    targetHexId.value = hexId
  }

  const clearTargetHex = () => {
    targetHexId.value = null
  }

  const setLiftedHex = (hexId: number) => {
    liftedHexId.value = hexId
  }

  const clearLiftedHex = () => {
    liftedHexId.value = null
  }

  const requestTab = (tab: string) => {
    tabRequest.value = { tab }
  }

  return {
    selectedTeam,
    targetHexId,
    liftedHexId,
    tabRequest,
    characterStore,
    artifactStore,
    handleTeamChange,
    handleClearAll,
    setTargetHex,
    clearTargetHex,
    setLiftedHex,
    clearLiftedHex,
    requestTab,
  }
}

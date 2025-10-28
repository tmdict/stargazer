import { State } from '@/lib/types/state'
import { useArtifactStore } from '@/stores/artifact'
import { useCharacterStore } from '@/stores/character'
import { useGridStore } from '@/stores/grid'

/**
 * Shared utility for resetting application state
 * Prevents code duplication across multiple stores
 */
export function useStateReset() {
  const characterStore = useCharacterStore()
  const artifactStore = useArtifactStore()
  const gridStore = useGridStore()

  /**
   * Clears all characters, artifacts, and resets tiles to DEFAULT
   * Used by URL state restoration, map editor, and other reset operations
   */
  const clearAllState = () => {
    // Clear characters and artifacts
    characterStore.clearAllCharacters()
    artifactStore.clearAllArtifacts()

    // Reset all tiles to DEFAULT state
    for (const hex of gridStore.hexes) {
      gridStore.setState(hex, State.DEFAULT)
    }
  }

  return {
    clearAllState,
    // Also expose individual clear functions for flexibility
    clearCharacters: () => characterStore.clearAllCharacters(),
    clearArtifacts: () => artifactStore.clearAllArtifacts(),
    clearTiles: () => {
      for (const hex of gridStore.hexes) {
        gridStore.setState(hex, State.DEFAULT)
      }
    },
  }
}

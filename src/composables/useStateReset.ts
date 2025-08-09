import { useArtifactStore } from '../stores/artifact'
import { useCharacterStore } from '../stores/character'

/**
 * Shared utility for resetting application state
 * Prevents code duplication across multiple stores
 */
export function useStateReset() {
  const characterStore = useCharacterStore()
  const artifactStore = useArtifactStore()

  /**
   * Clears all characters and artifacts
   * Used by URL state restoration, map editor, and other reset operations
   */
  const clearAllState = () => {
    characterStore.clearAllCharacters()
    artifactStore.clearAllArtifacts()
  }

  return {
    clearAllState,
    // Also expose individual clear functions for flexibility
    clearCharacters: () => characterStore.clearAllCharacters(),
    clearArtifacts: () => artifactStore.clearAllArtifacts(),
  }
}

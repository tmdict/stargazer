import { defineStore } from 'pinia'

import { State } from '../lib/types/state'
import { useStateReset } from '../composables/useStateReset'
import { useCharacterStore } from './character'
import { useGridStore } from './grid'

export const useMapEditorStore = defineStore('mapEditor', () => {
  // Store instances created once at store level
  const gridStore = useGridStore()
  const characterStore = useCharacterStore()
  const { clearCharacters } = useStateReset()

  /**
   * Sets a hex to the specified state (used by map editor)
   * Removes any existing character and resets the tile completely
   */
  const setHexState = (hexId: number, state: State): boolean => {
    const hex = gridStore.getHexById(hexId)
    if (!hex) return false

    const tile = gridStore.getTile(hexId)

    // Remove character if hex is occupied
    if (tile.state === State.OCCUPIED_ALLY || tile.state === State.OCCUPIED_ENEMY) {
      characterStore.removeCharacterFromHex(hexId)
    }

    // Set the new state
    gridStore.setState(hex, state)
    return true
  }

  /**
   * Resets all hexes to DEFAULT state (used by "Clear Map" button)
   * Removes all characters and resets all tiles completely
   */
  /**
   * Resets all hexes to a specific state with character clearing
   */
  const resetAllHexesToState = (state: State) => {
    // Clear all characters first using shared utility
    clearCharacters()

    // Reset all hexes to specified state
    for (const hex of gridStore.hexes) {
      gridStore.setState(hex, state)
    }
  }

  const clearAllHexStates = () => {
    resetAllHexesToState(State.DEFAULT)
  }

  const resetToCurrentMap = () => {
    // Get the current map configuration
    const mapConfig = gridStore.getCurrentMapConfig()
    if (!mapConfig) return

    // Reset all hexes to default first using shared utility
    resetAllHexesToState(State.DEFAULT)

    // Apply the original map states
    mapConfig.grid.forEach((mapState) => {
      mapState.hex.forEach((hexId) => {
        const hex = gridStore.getHexById(hexId)
        gridStore.setState(hex, mapState.type)
      })
    })
  }

  return {
    // Actions
    setHexState,
    clearAllHexStates,
    resetToCurrentMap,
  }
})

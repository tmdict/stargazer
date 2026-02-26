import { defineStore } from 'pinia'

import { useStateReset } from '@/composables/useStateReset'
import { DIAGONAL_ROWS } from '@/lib/types/grid'
import { State } from '@/lib/types/state'
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
    if (!gridStore.setState(hex, state)) {
      console.warn(`Failed to set state ${state} for hex at position (${hex.q}, ${hex.r})`)
      return false
    }
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
      if (!gridStore.setState(hex, state)) {
        console.warn(`Failed to reset hex at position (${hex.q}, ${hex.r}) to state ${state}`)
      }
    }
  }

  const applyAllHexStates = (state: State) => {
    resetAllHexesToState(state)
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
        if (!gridStore.setState(hex, mapState.type)) {
          console.warn(`Failed to restore map state ${mapState.type} for hex ${hexId}`)
        }
      })
    })
  }

  const flipMap = () => {
    clearCharacters()

    // Snapshot all states before mutating
    const snapshot = new Map(DIAGONAL_ROWS.flat().map((id) => [id, gridStore.getTile(id).state]))

    // Swap tile states between mirrored rows: row 1 ↔ row 15, row 2 ↔ row 14, etc.
    for (let i = 0; i < DIAGONAL_ROWS.length; i++) {
      const row = DIAGONAL_ROWS[i]!
      const mirrorRow = DIAGONAL_ROWS[DIAGONAL_ROWS.length - 1 - i]!
      row.forEach((id, j) => {
        gridStore.setState(gridStore.getHexById(id), snapshot.get(mirrorRow[j]!)!)
      })
    }
  }

  return {
    // Actions
    setHexState,
    applyAllHexStates,
    resetToCurrentMap,
    flipMap,
  }
})

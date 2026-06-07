import { ref } from 'vue'
import { defineStore } from 'pinia'

import { useStateReset } from '@/composables/useStateReset'
import { State } from '@/lib/types/state'
import { useCharacterStore } from './character'
import { useGridStore } from './grid'

export const useMapEditorStore = defineStore('mapEditor', () => {
  // Store instances created once at store level
  const gridStore = useGridStore()
  const characterStore = useCharacterStore()
  const { clearCharacters } = useStateReset()

  /**
   * Sets a hex to the specified state (used by map editor).
   * Removes any existing character and resets the tile completely.
   */
  const setHexState = (hexId: number, state: State): void => {
    const tile = gridStore.getTile(hexId)
    if (tile.state === State.OCCUPIED_ALLY || tile.state === State.OCCUPIED_ENEMY) {
      characterStore.removeCharacterFromHex(hexId)
    }
    gridStore.setState(gridStore.getHexById(hexId), state)
  }

  /**
   * Resets all hexes to a specific state with character clearing
   */
  const resetAllHexesToState = (state: State) => {
    // Clear all characters first using shared utility
    clearCharacters()

    for (const hex of gridStore.hexes) {
      gridStore.setState(hex, state)
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
        gridStore.setState(gridStore.getHexById(hexId), mapState.type)
      })
    })
  }

  // Color inversion state (visual only, does not change tile data)
  const isColorInverted = ref(false)

  const toggleColorInvert = () => {
    isColorInverted.value = !isColorInverted.value
  }

  return {
    // State
    isColorInverted,
    // Actions
    setHexState,
    applyAllHexStates,
    resetToCurrentMap,
    toggleColorInvert,
  }
})

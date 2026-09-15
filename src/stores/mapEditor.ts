import { defineStore } from 'pinia'

import { State } from '@/lib/types/state'
import { useCharacterStore } from './character'
import { useGridStore } from './grid'

export const useMapEditorStore = defineStore('mapEditor', () => {
  const gridStore = useGridStore()
  const characterStore = useCharacterStore()

  // An occupant is removed first (its team could change under it). The refresh
  // at the end is for terrain-aware skill paint (zone membership, blocked
  // tiles), which a tile edit never recomputes on its own.
  const setHexState = (hexId: number, state: State): void => {
    const tile = gridStore.getTile(hexId)
    if (tile.state === State.OCCUPIED_ALLY || tile.state === State.OCCUPIED_ENEMY) {
      characterStore.removeCharacterFromHex(hexId)
    }
    gridStore.setState(gridStore.getHexById(hexId), state)
    gridStore.refreshSkills()
  }

  const resetAllHexesToState = (state: State) => {
    characterStore.clearAllCharacters()
    gridStore.resetAllTiles(state)
  }

  const resetToCurrentMap = () => {
    const mapConfig = gridStore.getCurrentMapConfig()
    if (!mapConfig) return

    resetAllHexesToState(State.DEFAULT)
    mapConfig.grid.forEach((mapState) => {
      mapState.hex.forEach((hexId) => {
        gridStore.setState(gridStore.getHexById(hexId), mapState.type)
      })
    })
  }

  return {
    // Actions
    setHexState,
    resetAllHexesToState,
    resetToCurrentMap,
  }
})

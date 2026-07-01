import { computed } from 'vue'
import { defineStore } from 'pinia'

import type { GridTile } from '@/lib/grid'
import type { Hex } from '@/lib/hex'
import { defaultCanTraverse, findClosestTarget, findPathAStar } from '@/lib/pathfinding'
import { Team } from '@/lib/types/team'
import { useCharacterStore } from './character'
import { useGameDataStore } from './gameData'
import { useGridStore } from './grid'
import { useGrids } from './grids'

export const usePathfindingStore = defineStore('pathfinding', () => {
  // Store instances created once at store level
  const gridStore = useGridStore()
  const characterStore = useCharacterStore()
  const gameDataStore = useGameDataStore()
  const grids = useGrids()
  const active = () => grids.active!

  // Closest-target maps adapt the active board: GridContext owns the per-board
  // computation (GridArrows reads its own context), and this store serves only
  // the debug panel.
  const closestEnemyMap = computed(() => active().closestEnemyMap)
  const closestAllyMap = computed(() => active().closestAllyMap)

  // One direction of the debug visualization: each source character's closest
  // target and the A* path to it
  const collectDebugPaths = (
    sourceTiles: GridTile[],
    targetTiles: GridTile[],
    team: Team,
    getTile: (hex: Hex) => GridTile | undefined,
  ) => {
    const results: Array<{ fromHexId: number; toHexId: number; path: Hex[]; team: Team }> = []
    for (const sourceTile of sourceTiles) {
      const range = sourceTile.characterId
        ? (gameDataStore.getCharacterRange(sourceTile.characterId) ?? 1)
        : 1
      const closest = findClosestTarget(sourceTile, targetTiles, range, getTile, defaultCanTraverse)
      if (!closest) continue

      const targetTile = targetTiles.find((t) => t.hex.getId() === closest.hexId)
      if (!targetTile) continue

      const path = findPathAStar(sourceTile.hex, targetTile.hex, getTile, defaultCanTraverse)
      if (path) {
        results.push({ fromHexId: sourceTile.hex.getId(), toHexId: closest.hexId, path, team })
      }
    }
    return results
  }

  const debugPathfindingResults = computed(() => {
    // Only compute when there are characters on the grid
    if (characterStore.charactersPlaced === 0) {
      return []
    }

    const grid = gridStore._getGrid()
    const getTile = (hex: Hex) => grid.getTileOrUndefined(hex)
    const tilesWithCharacters = characterStore.getTilesWithCharacters()
    const allyTiles = tilesWithCharacters.filter((tile) => tile.team === Team.ALLY)
    const enemyTiles = tilesWithCharacters.filter((tile) => tile.team === Team.ENEMY)

    return [
      ...collectDebugPaths(allyTiles, enemyTiles, Team.ALLY, getTile),
      ...collectDebugPaths(enemyTiles, allyTiles, Team.ENEMY, getTile),
    ]
  })

  return {
    // Computed pathfinding data
    closestEnemyMap,
    closestAllyMap,
    debugPathfindingResults,
  }
})

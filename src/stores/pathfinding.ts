import { computed } from 'vue'
import { defineStore } from 'pinia'

import { isPhantimalId } from '@/lib/characters/phantimal'
import type { GridTile } from '@/lib/grid'
import type { Hex } from '@/lib/hex'
import {
  defaultCanTraverse,
  findClosestTarget,
  findPathAStar,
  getClosestTargetMap,
} from '@/lib/pathfinding'
import { Team } from '@/lib/types/team'
import { useCharacterStore } from './character'
import { useGameDataStore } from './gameData'
import { useGridStore } from './grid'

export const usePathfindingStore = defineStore('pathfinding', () => {
  // Store instances created once at store level
  const gridStore = useGridStore()
  const characterStore = useCharacterStore()
  const gameDataStore = useGameDataStore()

  // The static range map is keyed by character id; phantimals carry their range in
  // their own data, so add an entry for each on-grid phantimal as a targeting source.
  const buildUnitRanges = (tiles: GridTile[]): Map<number, number> => {
    const ranges = new Map(gameDataStore.characterRanges)
    for (const tile of tiles) {
      if (tile.characterId !== undefined && isPhantimalId(tile.characterId)) {
        ranges.set(tile.characterId, gameDataStore.getCharacterRange(tile.characterId))
      }
    }
    return ranges
  }

  // Computed properties memoize these maps: they recompute only when the reactive
  // grid state they read (placements, tile states, ranges) actually changes.
  const makeClosestMap = (sourceTeam: Team, targetTeam: Team) =>
    computed(() => {
      const tilesWithCharacters = characterStore.getTilesWithCharacters()
      const characterRanges = buildUnitRanges(tilesWithCharacters)
      const grid = gridStore._getGrid()
      return getClosestTargetMap(
        tilesWithCharacters,
        sourceTeam,
        targetTeam,
        (hex) => grid.getTileOrUndefined(hex),
        characterRanges,
      )
    })

  const closestEnemyMap = makeClosestMap(Team.ALLY, Team.ENEMY)
  const closestAllyMap = makeClosestMap(Team.ENEMY, Team.ALLY)

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

  // Debug pathfinding results for visualization
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

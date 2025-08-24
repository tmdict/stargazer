import { computed } from 'vue'
import { defineStore } from 'pinia'

import type { Hex } from '../lib/hex'
import {
  defaultCanTraverse,
  findClosestTarget,
  findPathAStar,
  getClosestTargetMap,
} from '../lib/pathfinding'
import { Team } from '../lib/types/team'
import { useCharacterStore } from './character'
import { useGameDataStore } from './gameData'
import { useGridStore } from './grid'

export const usePathfindingStore = defineStore('pathfinding', () => {
  /*
   * Cache Configuration
   */
  // Set to false to disable all pathfinding caching across the application
  const ENABLE_CACHE = true

  // Store instances created once at store level
  const gridStore = useGridStore()
  const characterStore = useCharacterStore()
  const gameDataStore = useGameDataStore()

  // Lazy evaluation for expensive computations - only compute when accessed
  const closestEnemyMap = computed(() => {
    const tilesWithCharacters = characterStore.getTilesWithCharacters()
    const characterRanges = new Map(gameDataStore.characterRanges)
    const grid = gridStore._getGrid()
    return getClosestTargetMap(
      tilesWithCharacters,
      Team.ALLY,
      Team.ENEMY,
      characterRanges,
      ENABLE_CACHE,
      (hex) => {
        try {
          return grid.getTile(hex)
        } catch {
          return undefined
        }
      },
    )
  })

  const closestAllyMap = computed(() => {
    const tilesWithCharacters = characterStore.getTilesWithCharacters()
    const characterRanges = new Map(gameDataStore.characterRanges)
    const grid = gridStore._getGrid()
    return getClosestTargetMap(
      tilesWithCharacters,
      Team.ENEMY,
      Team.ALLY,
      characterRanges,
      ENABLE_CACHE,
      (hex) => {
        try {
          return grid.getTile(hex)
        } catch {
          return undefined
        }
      },
    )
  })

  // Debug pathfinding results for visualization
  const debugPathfindingResults = computed(() => {
    const grid = gridStore._getGrid()

    // Only compute when there are characters on the grid
    if (characterStore.charactersPlaced === 0) {
      return []
    }

    const results: Array<{ fromHexId: number; toHexId: number; path: Hex[]; team: Team }> = []
    const tilesWithCharacters = characterStore.getTilesWithCharacters()
    const allyTiles = tilesWithCharacters.filter((tile) => tile.team === Team.ALLY)
    const enemyTiles = tilesWithCharacters.filter((tile) => tile.team === Team.ENEMY)

    // Safe getTile helper - returns undefined for out-of-bounds hexes during pathfinding
    const getTileHelper = (hex: Hex) => {
      try {
        return grid.getTile(hex)
      } catch {
        return undefined
      }
    }

    // Get paths from allies to closest enemies using shared pathfinding logic
    for (const allyTile of allyTiles) {
      const range = allyTile.characterId
        ? (gameDataStore.getCharacterRange(allyTile.characterId) ?? 1)
        : 1
      const closestEnemy = findClosestTarget(
        allyTile,
        enemyTiles,
        range,
        getTileHelper,
        defaultCanTraverse,
      )

      if (closestEnemy) {
        const targetTile = enemyTiles.find((t) => t.hex.getId() === closestEnemy.hexId)
        if (targetTile) {
          const path = findPathAStar(
            allyTile.hex,
            targetTile.hex,
            getTileHelper,
            defaultCanTraverse,
          )
          if (path) {
            results.push({
              fromHexId: allyTile.hex.getId(),
              toHexId: closestEnemy.hexId,
              path,
              team: Team.ALLY,
            })
          }
        }
      }
    }

    // Get paths from enemies to closest allies using shared pathfinding logic
    for (const enemyTile of enemyTiles) {
      const range = enemyTile.characterId
        ? (gameDataStore.getCharacterRange(enemyTile.characterId) ?? 1)
        : 1
      const closestAlly = findClosestTarget(
        enemyTile,
        allyTiles,
        range,
        getTileHelper,
        defaultCanTraverse,
      )

      if (closestAlly) {
        const targetTile = allyTiles.find((t) => t.hex.getId() === closestAlly.hexId)
        if (targetTile) {
          const path = findPathAStar(
            enemyTile.hex,
            targetTile.hex,
            getTileHelper,
            defaultCanTraverse,
          )
          if (path) {
            results.push({
              fromHexId: enemyTile.hex.getId(),
              toHexId: closestAlly.hexId,
              path,
              team: Team.ENEMY,
            })
          }
        }
      }
    }

    return results
  })

  return {
    // Computed pathfinding data
    closestEnemyMap,
    closestAllyMap,
    debugPathfindingResults,
  }
})

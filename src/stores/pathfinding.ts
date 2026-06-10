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
  const closestEnemyMap = computed(() => {
    const tilesWithCharacters = characterStore.getTilesWithCharacters()
    const characterRanges = buildUnitRanges(tilesWithCharacters)
    const grid = gridStore._getGrid()
    return getClosestTargetMap(
      tilesWithCharacters,
      Team.ALLY,
      Team.ENEMY,
      (hex) => {
        try {
          return grid.getTile(hex)
        } catch {
          return undefined
        }
      },
      characterRanges,
    )
  })

  const closestAllyMap = computed(() => {
    const tilesWithCharacters = characterStore.getTilesWithCharacters()
    const characterRanges = buildUnitRanges(tilesWithCharacters)
    const grid = gridStore._getGrid()
    return getClosestTargetMap(
      tilesWithCharacters,
      Team.ENEMY,
      Team.ALLY,
      (hex) => {
        try {
          return grid.getTile(hex)
        } catch {
          return undefined
        }
      },
      characterRanges,
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

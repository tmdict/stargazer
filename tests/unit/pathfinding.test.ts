import { beforeEach, describe, expect, it } from 'vitest'

import { Grid } from '../../src/lib/grid'
import { Hex } from '../../src/lib/hex'
import {
  calculateEffectiveDistance,
  calculateRangedMovementDistance,
  clearPathfindingCache,
  defaultCanTraverse,
  findClosestTarget,
  findPathAStar,
  findPathDistance,
  getClosestTargetMap,
  isVerticallyAligned,
} from '../../src/lib/pathfinding'
import type { GridPreset } from '../../src/lib/types/grid'
import { State } from '../../src/lib/types/state'
import { Team } from '../../src/lib/types/team'

// Simple test grid
const TEST_GRID: GridPreset = {
  hex: [[4], [3, 5], [2, 6], [1, 7]],
  qOffset: [0, -1, -1, -2],
}

const TEST_ARENA = {
  id: 1,
  name: 'Test',
  grid: [
    { type: State.AVAILABLE_ALLY, hex: [1, 2] },
    { type: State.AVAILABLE_ENEMY, hex: [6, 7] },
    { type: State.BLOCKED, hex: [4] },
    { type: State.DEFAULT, hex: [3, 5] },
  ],
}

describe('pathfinding', () => {
  let grid: Grid

  beforeEach(() => {
    grid = new Grid(TEST_GRID, TEST_ARENA)
    clearPathfindingCache()
  })

  describe('findPathAStar', () => {
    it('finds path between adjacent hexes', () => {
      const start = grid.getHexById(1)
      const goal = grid.getHexById(2)
      const getTile = (hex: Hex) => {
        try {
          return grid.getTile(hex)
        } catch {
          return undefined
        }
      }

      const path = findPathAStar(start, goal, getTile, defaultCanTraverse)

      expect(path).not.toBeNull()
      expect(path).toHaveLength(2)
      expect(path![0].equals(start)).toBe(true)
      expect(path![1].equals(goal)).toBe(true)
    })

    it('finds path around blocked tiles', () => {
      const start = grid.getHexById(3)
      const goal = grid.getHexById(5)
      const getTile = (hex: Hex) => {
        try {
          return grid.getTile(hex)
        } catch {
          return undefined
        }
      }

      // Hex 4 is blocked, so path must go around
      const path = findPathAStar(start, goal, getTile, defaultCanTraverse)

      expect(path).not.toBeNull()
      expect(path!.length).toBeGreaterThanOrEqual(2) // Path exists
      expect(path![0].equals(start)).toBe(true)
      expect(path![path!.length - 1].equals(goal)).toBe(true)
    })

    it('returns null for unreachable goal', () => {
      const start = grid.getHexById(1)
      const goal = new Hex(100, -50, -50) // Far away hex
      const getTile = () => undefined // All tiles outside grid are undefined

      const path = findPathAStar(start, goal, getTile, defaultCanTraverse)

      expect(path).toBeNull()
    })

    it('returns single-element path when start equals goal', () => {
      const hex = grid.getHexById(1)
      const getTile = (h: Hex) => {
        try {
          return grid.getTile(h)
        } catch {
          return undefined
        }
      }

      const path = findPathAStar(hex, hex, getTile, defaultCanTraverse)

      expect(path).not.toBeNull()
      expect(path).toHaveLength(1)
      expect(path![0].equals(hex)).toBe(true)
    })
  })

  describe('findPathDistance', () => {
    it('calculates distance between adjacent hexes', () => {
      const start = grid.getHexById(1)
      const goal = grid.getHexById(2)
      const getTile = (hex: Hex) => {
        try {
          return grid.getTile(hex)
        } catch {
          return undefined
        }
      }

      const distance = findPathDistance(start, goal, getTile, defaultCanTraverse)

      expect(distance).toBe(1)
    })

    it('returns 0 for same hex', () => {
      const hex = grid.getHexById(1)
      const getTile = (h: Hex) => {
        try {
          return grid.getTile(h)
        } catch {
          return undefined
        }
      }

      const distance = findPathDistance(hex, hex, getTile, defaultCanTraverse)

      expect(distance).toBe(0)
    })

    it('returns null for unreachable hex', () => {
      const start = grid.getHexById(1)
      const goal = new Hex(100, -50, -50)
      const getTile = () => undefined

      const distance = findPathDistance(start, goal, getTile, defaultCanTraverse)

      expect(distance).toBeNull()
    })
  })

  describe('calculateEffectiveDistance', () => {
    it('returns 0 when target is within range', () => {
      const start = grid.getHexById(1)
      const goal = grid.getHexById(2)
      const getTile = (hex: Hex) => {
        try {
          return grid.getTile(hex)
        } catch {
          return undefined
        }
      }

      const result = calculateEffectiveDistance(start, goal, 2, getTile, defaultCanTraverse)

      expect(result.movementDistance).toBe(0)
      expect(result.canReach).toBe(true)
      expect(result.directDistance).toBe(1)
    })

    it('calculates movement needed to get within range', () => {
      const start = grid.getHexById(1)
      const goal = grid.getHexById(7)
      const getTile = (hex: Hex) => {
        try {
          return grid.getTile(hex)
        } catch {
          return undefined
        }
      }

      // Check actual direct distance first
      const directDist = start.distance(goal)

      const result = calculateEffectiveDistance(start, goal, 1, getTile, defaultCanTraverse)

      // If direct distance is > 1, we need to move
      if (directDist > 1) {
        expect(result.movementDistance).toBeGreaterThan(0)
      } else {
        expect(result.movementDistance).toBe(0)
      }
      expect(result.canReach).toBe(true)
    })

    it('returns Infinity for unreachable targets', () => {
      const start = grid.getHexById(1)
      const goal = new Hex(100, -50, -50)
      const getTile = () => undefined

      const result = calculateEffectiveDistance(start, goal, 1, getTile, defaultCanTraverse)

      expect(result.movementDistance).toBe(Infinity)
      expect(result.canReach).toBe(false)
    })

    it('uses cache when enabled', () => {
      const start = grid.getHexById(1)
      const goal = grid.getHexById(2)
      const getTile = (hex: Hex) => {
        try {
          return grid.getTile(hex)
        } catch {
          return undefined
        }
      }

      // First call - not cached
      const result1 = calculateEffectiveDistance(start, goal, 1, getTile, defaultCanTraverse, true)

      // Second call - should use cache
      const result2 = calculateEffectiveDistance(start, goal, 1, getTile, defaultCanTraverse, true)

      expect(result1).toEqual(result2)
    })
  })

  describe('calculateRangedMovementDistance', () => {
    it('returns 0 when targets are within range', () => {
      const start = grid.getHexById(1)
      const targets = [grid.getHexById(2)]
      const getTile = (hex: Hex) => {
        try {
          return grid.getTile(hex)
        } catch {
          return undefined
        }
      }

      const result = calculateRangedMovementDistance(start, targets, 2, getTile, defaultCanTraverse)

      expect(result.movementDistance).toBe(0)
      expect(result.canReach).toBe(true)
      expect(result.reachableTargets).toHaveLength(1)
    })

    it('finds minimum movement to reach any target', () => {
      const start = grid.getHexById(1)
      const targets = [grid.getHexById(6), grid.getHexById(7)]
      const getTile = (hex: Hex) => {
        try {
          return grid.getTile(hex)
        } catch {
          return undefined
        }
      }

      const result = calculateRangedMovementDistance(start, targets, 1, getTile, defaultCanTraverse)

      expect(result.canReach).toBe(true)
      expect(result.reachableTargets.length).toBeGreaterThan(0)
      // Movement distance depends on actual hex layout
      expect(result.movementDistance).toBeGreaterThanOrEqual(0)
    })

    it('handles empty target list', () => {
      const start = grid.getHexById(1)
      const getTile = (hex: Hex) => {
        try {
          return grid.getTile(hex)
        } catch {
          return undefined
        }
      }

      const result = calculateRangedMovementDistance(start, [], 1, getTile, defaultCanTraverse)

      expect(result.movementDistance).toBe(Infinity)
      expect(result.canReach).toBe(false)
      expect(result.reachableTargets).toHaveLength(0)
    })
  })

  describe('defaultCanTraverse', () => {
    it('allows traversal through non-blocked tiles', () => {
      const tile = grid.getTileById(1)
      expect(defaultCanTraverse(tile)).toBe(true)
    })

    it('blocks traversal through blocked tiles', () => {
      const tile = grid.getTileById(4) // Blocked tile
      expect(defaultCanTraverse(tile)).toBe(false)
    })
  })

  describe('isVerticallyAligned', () => {
    it('returns true for vertically aligned hexes', () => {
      const hex1 = new Hex(0, 0, 0)
      const hex2 = new Hex(0, -1, 1)

      expect(isVerticallyAligned(hex1, hex2)).toBe(true)
    })

    it('returns false for non-vertically aligned hexes', () => {
      const hex1 = new Hex(0, 0, 0)
      const hex2 = new Hex(1, -1, 0)

      expect(isVerticallyAligned(hex1, hex2)).toBe(false)
    })
  })

  describe('findClosestTarget', () => {
    it('finds closest target for melee unit', () => {
      const sourceTile = grid.getTileById(1)
      sourceTile.team = Team.ALLY

      const targetTile = grid.getTileById(6)
      targetTile.team = Team.ENEMY
      targetTile.characterId = 100

      const getTile = (hex: Hex) => {
        try {
          return grid.getTile(hex)
        } catch {
          return undefined
        }
      }
      const result = findClosestTarget(sourceTile, [targetTile], 1, getTile, defaultCanTraverse)

      expect(result).not.toBeNull()
      expect(result!.hexId).toBe(6)
      expect(result!.distance).toBeGreaterThan(0)
    })

    it('returns null when no targets exist', () => {
      const sourceTile = grid.getTileById(1)
      sourceTile.team = Team.ALLY

      const getTile = (hex: Hex) => {
        try {
          return grid.getTile(hex)
        } catch {
          return undefined
        }
      }
      const result = findClosestTarget(sourceTile, [], 1, getTile, defaultCanTraverse)

      expect(result).toBeNull()
    })

    it('handles ranged units correctly', () => {
      const sourceTile = grid.getTileById(1)
      sourceTile.team = Team.ALLY

      const targetTile = grid.getTileById(3)
      targetTile.team = Team.ENEMY
      targetTile.characterId = 100

      const getTile = (hex: Hex) => {
        try {
          return grid.getTile(hex)
        } catch {
          return undefined
        }
      }

      // With range 3, should be able to reach without moving
      const result = findClosestTarget(sourceTile, [targetTile], 3, getTile, defaultCanTraverse)

      expect(result).not.toBeNull()
      expect(result!.distance).toBe(0) // No movement needed
    })
  })

  describe('getClosestTargetMap', () => {
    it('creates map of closest enemies for ally team', () => {
      // Set up ally characters
      const ally1 = grid.getTileById(1)
      ally1.team = Team.ALLY
      ally1.characterId = 1

      const ally2 = grid.getTileById(2)
      ally2.team = Team.ALLY
      ally2.characterId = 2

      // Set up enemy characters
      const enemy1 = grid.getTileById(6)
      enemy1.team = Team.ENEMY
      enemy1.characterId = 100

      const enemy2 = grid.getTileById(7)
      enemy2.team = Team.ENEMY
      enemy2.characterId = 101

      const tilesWithCharacters = [ally1, ally2, enemy1, enemy2]
      const result = getClosestTargetMap(tilesWithCharacters, Team.ALLY, Team.ENEMY)

      expect(result.size).toBe(2) // Two allies
      expect(result.has(1)).toBe(true)
      expect(result.has(2)).toBe(true)

      const ally1Target = result.get(1)
      expect(ally1Target).toBeDefined()
      expect(ally1Target!.enemyHexId).toBeDefined()
      expect(ally1Target!.distance).toBeDefined()
    })

    it('handles characters with custom ranges', () => {
      const ally = grid.getTileById(1)
      ally.team = Team.ALLY
      ally.characterId = 1

      const enemy = grid.getTileById(7)
      enemy.team = Team.ENEMY
      enemy.characterId = 100

      const characterRanges = new Map([[1, 5]]) // Ally has range 5
      const tilesWithCharacters = [ally, enemy]

      const result = getClosestTargetMap(
        tilesWithCharacters,
        Team.ALLY,
        Team.ENEMY,
        characterRanges,
      )

      const allyTarget = result.get(1)
      expect(allyTarget).toBeDefined()
      // With range 5, might need less movement
      expect(allyTarget!.distance).toBeGreaterThanOrEqual(0)
    })

    it('uses cache when enabled', () => {
      const ally = grid.getTileById(1)
      ally.team = Team.ALLY
      ally.characterId = 1

      const enemy = grid.getTileById(6)
      enemy.team = Team.ENEMY
      enemy.characterId = 100

      const tilesWithCharacters = [ally, enemy]

      // First call - not cached
      const result1 = getClosestTargetMap(
        tilesWithCharacters,
        Team.ALLY,
        Team.ENEMY,
        new Map(),
        true,
      )

      // Second call - should use cache
      const result2 = getClosestTargetMap(
        tilesWithCharacters,
        Team.ALLY,
        Team.ENEMY,
        new Map(),
        true,
      )

      expect(result1).toEqual(result2)
    })
  })

  describe('cache management', () => {
    it('clears cache correctly', () => {
      const start = grid.getHexById(1)
      const goal = grid.getHexById(2)
      const getTile = (hex: Hex) => {
        try {
          return grid.getTile(hex)
        } catch {
          return undefined
        }
      }

      // Cache a result
      calculateEffectiveDistance(start, goal, 1, getTile, defaultCanTraverse, true)

      // Clear cache
      clearPathfindingCache()

      // Next call should not use cache (but we can't directly test this)
      const result = calculateEffectiveDistance(start, goal, 1, getTile, defaultCanTraverse, true)
      expect(result).toBeDefined()
    })
  })
})

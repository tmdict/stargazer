import { beforeEach, describe, expect, it } from 'vitest'

import { Grid } from '@/lib/grid'
import { Hex } from '@/lib/hex'
import {
  calculateRangedMovementDistance,
  defaultCanTraverse,
  findClosestTarget,
  findPathAStar,
  getClosestTargetMap,
} from '@/lib/pathfinding'
import type { GridPreset } from '@/lib/types/grid'
import { State } from '@/lib/types/state'
import { Team } from '@/lib/types/team'

// 7-hex grid; key geometry for the assertions below:
// hex 7 shares q with hex 2 (vertically aligned); hexes 3 and 6 share the
// q−r diagonal; from hex 1, hexes 3/5/6 are all direct distance 2
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
  let getTile: (hex: Hex) => ReturnType<Grid['getTileOrUndefined']>

  beforeEach(() => {
    grid = new Grid(TEST_GRID, TEST_ARENA)
    getTile = (hex: Hex) => grid.getTileOrUndefined(hex)
  })

  const pathIds = (path: Hex[]) => path.map((h) => grid.getTile(h).hex.getId())

  describe('findPathAStar', () => {
    it('finds path between adjacent hexes', () => {
      const start = grid.getHexById(1)
      const goal = grid.getHexById(2)

      const path = findPathAStar(start, goal, getTile, defaultCanTraverse)

      expect(path).not.toBeNull()
      expect(pathIds(path!)).toEqual([1, 2])
    })

    it('finds the optimal path when unobstructed', () => {
      const path = findPathAStar(
        grid.getHexById(1),
        grid.getHexById(5),
        getTile,
        defaultCanTraverse,
      )

      expect(path).not.toBeNull()
      expect(pathIds(path!)).toEqual([1, 2, 5])
    })

    it('routes around blocked tiles', () => {
      // Hex 2 is the only direct step from 1 toward 5; blocking it forces
      // the unique detour through 7 and 6, one longer than the optimum
      grid.getTileById(2).state = State.BLOCKED

      const path = findPathAStar(
        grid.getHexById(1),
        grid.getHexById(5),
        getTile,
        defaultCanTraverse,
      )

      expect(path).not.toBeNull()
      expect(pathIds(path!)).toEqual([1, 7, 6, 5])
    })

    it('returns null for unreachable goal', () => {
      const start = grid.getHexById(1)
      const goal = new Hex(100, -50, -50) // outside the grid

      const path = findPathAStar(start, goal, getTile, defaultCanTraverse)

      expect(path).toBeNull()
    })

    it('returns single-element path when start equals goal', () => {
      const hex = grid.getHexById(1)

      const path = findPathAStar(hex, hex, getTile, defaultCanTraverse)

      expect(path).not.toBeNull()
      expect(pathIds(path!)).toEqual([1])
    })
  })

  describe('calculateRangedMovementDistance', () => {
    it('returns 0 when targets are within range', () => {
      const start = grid.getHexById(1)
      const targets = [grid.getHexById(2)]

      const result = calculateRangedMovementDistance(start, targets, 2, getTile, defaultCanTraverse)

      expect(result.movementDistance).toBe(0)
      expect(result.canReach).toBe(true)
      expect(result.reachableTargets).toHaveLength(1)
    })

    it('finds minimum movement to reach a distant target', () => {
      // Hex 6 is direct distance 2 from hex 1, so a melee unit must step once
      const start = grid.getHexById(1)
      const targets = [grid.getHexById(6)]

      const result = calculateRangedMovementDistance(start, targets, 1, getTile, defaultCanTraverse)

      expect(result.movementDistance).toBe(1)
      expect(result.canReach).toBe(true)
      expect(result.reachableTargets.map((h) => h.getId())).toEqual([6])
    })

    it('handles empty target list', () => {
      const start = grid.getHexById(1)

      const result = calculateRangedMovementDistance(start, [], 1, getTile, defaultCanTraverse)

      expect(result.movementDistance).toBe(Infinity)
      expect(result.canReach).toBe(false)
      expect(result.reachableTargets).toHaveLength(0)
    })
  })

  describe('findClosestTarget', () => {
    const occupy = (hexId: number, team: Team, characterId?: number) => {
      const tile = grid.getTileById(hexId)
      tile.team = team
      if (characterId) tile.characterId = characterId
      return tile
    }

    it('finds closest target for melee unit', () => {
      const sourceTile = occupy(1, Team.ALLY)
      const targetTile = occupy(6, Team.ENEMY, 100)

      const result = findClosestTarget(sourceTile, [targetTile], 1, getTile, defaultCanTraverse)

      expect(result).not.toBeNull()
      expect(result!.hexId).toBe(6)
      expect(result!.distance).toBe(1)
    })

    it('returns null when no targets exist', () => {
      const sourceTile = occupy(1, Team.ALLY)

      const result = findClosestTarget(sourceTile, [], 1, getTile, defaultCanTraverse)

      expect(result).toBeNull()
    })

    it('requires no movement when target is within attack range', () => {
      const sourceTile = occupy(1, Team.ALLY)
      const targetTile = occupy(3, Team.ENEMY, 100)

      // Range 3 covers the direct distance of 2, so no movement is needed
      const result = findClosestTarget(sourceTile, [targetTile], 3, getTile, defaultCanTraverse)

      expect(result).not.toBeNull()
      expect(result!.distance).toBe(0)
    })

    describe('tie-breaking between equally distant targets', () => {
      it('Rule 1: prefers the vertically aligned target', () => {
        // From hex 2, hexes 6 and 7 are both reachable without moving;
        // hex 7 shares q with the source
        const sourceTile = occupy(2, Team.ALLY)
        const targets = [occupy(6, Team.ENEMY, 100), occupy(7, Team.ENEMY, 101)]

        const result = findClosestTarget(sourceTile, targets, 1, getTile, defaultCanTraverse)

        expect(result!.hexId).toBe(7)
      })

      it('Rule 2: same diagonal — ally prefers the higher hex ID', () => {
        // Hexes 3 and 6 share the q−r diagonal and are both one move from hex 1
        const sourceTile = occupy(1, Team.ALLY)
        const targets = [occupy(3, Team.ENEMY, 100), occupy(6, Team.ENEMY, 101)]

        const result = findClosestTarget(sourceTile, targets, 1, getTile, defaultCanTraverse)

        expect(result!.hexId).toBe(6)
      })

      it('Rule 2: same diagonal — enemy prefers the lower hex ID', () => {
        const sourceTile = occupy(1, Team.ENEMY)
        const targets = [occupy(3, Team.ALLY, 100), occupy(6, Team.ALLY, 101)]

        const result = findClosestTarget(sourceTile, targets, 1, getTile, defaultCanTraverse)

        expect(result!.hexId).toBe(3)
      })

      it('Rule 3 fallback: equal direct distance resolves by team ID preference', () => {
        // Hexes 5 and 6 sit on different diagonals, neither vertical with
        // hex 1, both direct distance 2 and one move away
        const allySource = occupy(1, Team.ALLY)
        const targets = [occupy(5, Team.ENEMY, 100), occupy(6, Team.ENEMY, 101)]

        const allyResult = findClosestTarget(allySource, targets, 1, getTile, defaultCanTraverse)
        expect(allyResult!.hexId).toBe(6)

        allySource.team = Team.ENEMY
        const enemyResult = findClosestTarget(allySource, targets, 1, getTile, defaultCanTraverse)
        expect(enemyResult!.hexId).toBe(5)
      })
    })
  })

  describe('getClosestTargetMap', () => {
    it('creates map of closest enemies for ally team', () => {
      const ally1 = grid.getTileById(1)
      ally1.team = Team.ALLY
      ally1.characterId = 1

      const ally2 = grid.getTileById(2)
      ally2.team = Team.ALLY
      ally2.characterId = 2

      const enemy1 = grid.getTileById(6)
      enemy1.team = Team.ENEMY
      enemy1.characterId = 100

      const enemy2 = grid.getTileById(7)
      enemy2.team = Team.ENEMY
      enemy2.characterId = 101

      const tilesWithCharacters = [ally1, ally2, enemy1, enemy2]
      const result = getClosestTargetMap(tilesWithCharacters, Team.ALLY, Team.ENEMY, getTile)

      // Hex 7 is adjacent to hex 1 and vertically aligned with hex 2, so it
      // wins for both allies with no movement required
      expect(result.size).toBe(2)
      expect(result.get(1)).toMatchObject({ enemyHexId: 7, distance: 0 })
      expect(result.get(2)).toMatchObject({ enemyHexId: 7, distance: 0 })
    })

    it('consults custom ranges instead of the default melee range', () => {
      const ally = grid.getTileById(1)
      ally.team = Team.ALLY
      ally.characterId = 1

      const enemy = grid.getTileById(5)
      enemy.team = Team.ENEMY
      enemy.characterId = 100

      const tilesWithCharacters = [ally, enemy]

      // Hex 5 is direct distance 2: melee range needs one move
      const melee = getClosestTargetMap(tilesWithCharacters, Team.ALLY, Team.ENEMY, getTile)
      expect(melee.get(1)).toMatchObject({ enemyHexId: 5, distance: 1 })

      // Range 5 covers it from the starting tile
      const ranged = getClosestTargetMap(
        tilesWithCharacters,
        Team.ALLY,
        Team.ENEMY,
        getTile,
        new Map([[1, 5]]),
      )
      expect(ranged.get(1)).toMatchObject({ enemyHexId: 5, distance: 0 })
    })
  })
})

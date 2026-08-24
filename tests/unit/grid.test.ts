import { beforeEach, describe, expect, it } from 'vitest'

import { artifactHostHex, Grid, rotatedHexId } from '@/lib/grid'
import { Hex } from '@/lib/hex'
import { FULL_GRID } from '@/lib/types/grid'
import { State } from '@/lib/types/state'
import { Team } from '@/lib/types/team'
import { SMALL_GRID } from './fixtures/grid'

// Arena exercising every tile-state type on SMALL_GRID
const TEST_ARENA = {
  id: 1,
  name: 'Test',
  grid: [
    { type: State.AVAILABLE_ALLY, hex: [1, 2] },
    { type: State.AVAILABLE_ENEMY, hex: [3] },
    { type: State.BLOCKED, hex: [4] },
    { type: State.DEFAULT, hex: [5] },
  ],
}

describe('Grid', () => {
  let grid: Grid

  describe('constructor and initialization', () => {
    it('should initialize with default FULL_GRID layout', () => {
      grid = new Grid()

      expect(grid.getAllTiles()).toHaveLength(45)
      expect(grid.gridPreset).toBe(FULL_GRID)
      expect(grid.getAllTiles().every((tile) => tile.characterId === undefined)).toBe(true)
      expect(grid.maxTeamSizes.get(Team.ALLY)).toBe(5)
      expect(grid.maxTeamSizes.get(Team.ENEMY)).toBe(5)
      expect(grid.companionIdOffset).toBe(10000)
      expect(grid.companionLinks.size).toBe(0)
      expect(grid.skillManager).toBeUndefined()
    })

    it('should initialize with custom layout and map', () => {
      grid = new Grid(SMALL_GRID, TEST_ARENA)

      expect(grid.getAllTiles()).toHaveLength(5)
      expect(grid.gridPreset).toBe(SMALL_GRID)

      // Check states are applied from TEST_ARENA
      expect(grid.getTileById(1).state).toBe(State.AVAILABLE_ALLY)
      expect(grid.getTileById(2).state).toBe(State.AVAILABLE_ALLY)
      expect(grid.getTileById(3).state).toBe(State.AVAILABLE_ENEMY)
      expect(grid.getTileById(4).state).toBe(State.BLOCKED)
      expect(grid.getTileById(5).state).toBe(State.DEFAULT)
    })
  })

  describe('tile access methods', () => {
    beforeEach(() => {
      grid = new Grid(SMALL_GRID, TEST_ARENA)
    })

    it('should get tiles by ID', () => {
      const tile = grid.getTileById(2)
      expect(tile.hex.getId()).toBe(2)
      expect(tile.state).toBe(State.AVAILABLE_ALLY)
    })

    it('should get tiles by hex', () => {
      const hex = grid.getHexById(1)
      const tile = grid.getTile(hex)
      expect(tile.hex).toBe(hex)
      expect(tile.state).toBe(State.AVAILABLE_ALLY)
    })

    it('should return all tiles and hex keys', () => {
      const tiles = grid.getAllTiles()
      expect(tiles).toHaveLength(5)
      tiles.forEach((tile) => {
        expect(tile.hex).toBeInstanceOf(Hex)
        expect(Object.values(State).includes(tile.state)).toBe(true)
      })

      const keys = grid.keys()
      expect(keys).toHaveLength(5)
      keys.forEach((hex) => {
        expect(hex).toBeInstanceOf(Hex)
      })
    })

    it('should throw error for invalid hex ID', () => {
      expect(() => grid.getHexById(999)).toThrow('Hex with ID 999 not found')
      expect(() => grid.getTileById(999)).toThrow('Hex with ID 999 not found')
    })

    it('should throw error for invalid hex coordinates', () => {
      const invalidHex = new Hex(999, 999, -1998, 999)
      expect(() => grid.getTile(invalidHex)).toThrow('Tile with hex key 999,999,-1998 not found')
    })

    it('should return undefined from getTileOrUndefined for out-of-grid hexes', () => {
      expect(grid.getTileOrUndefined(grid.getHexById(1))).toBe(grid.getTileById(1))
      expect(grid.getTileOrUndefined(new Hex(999, 999, -1998))).toBeUndefined()
    })
  })

  describe('edge cases', () => {
    it('should preserve tile references', () => {
      grid = new Grid(SMALL_GRID, TEST_ARENA)

      const tile1 = grid.getTileById(1)
      const tile2 = grid.getTileById(1)
      expect(tile1).toBe(tile2)

      tile1.characterId = 100
      tile1.team = Team.ALLY
      expect(tile2.characterId).toBe(100)
      expect(tile2.team).toBe(Team.ALLY)
    })
  })
})

describe('artifactHostHex', () => {
  it('is the off-grid neighbour left of cell 1 (ally) and right of cell 45 (enemy)', () => {
    const grid = new Grid()
    const ally = artifactHostHex(grid, Team.ALLY)
    const enemy = artifactHostHex(grid, Team.ENEMY)

    expect(ally.equals(grid.getHexById(1).neighbor(4))).toBe(true)
    expect(enemy.equals(grid.getHexById(45).neighbor(1))).toBe(true)
    expect(grid.getTileOrUndefined(ally)).toBeUndefined()
    expect(grid.getTileOrUndefined(enemy)).toBeUndefined()
  })
})

describe('rotatedHexId', () => {
  it('maps a hex onto its 180-degree counterpart (46 - id on the full grid)', () => {
    const grid = new Grid()
    expect(rotatedHexId(grid, 1)).toBe(45)
    expect(rotatedHexId(grid, 45)).toBe(1)
    expect(rotatedHexId(grid, 14)).toBe(32)
    // The center cell rotates onto itself.
    expect(rotatedHexId(grid, 23)).toBe(23)
  })

  it('is undefined for an unknown id', () => {
    const grid = new Grid()
    expect(rotatedHexId(grid, 0)).toBeUndefined()
    expect(rotatedHexId(grid, 99)).toBeUndefined()
  })
})

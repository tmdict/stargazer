import { beforeEach, describe, expect, it, vi } from 'vitest'

import { Grid } from '@/lib/grid'
import { Hex } from '@/lib/hex'
import { FULL_GRID, type GridPreset } from '@/lib/types/grid'
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
      expect(grid.teamCharacters.get(Team.ALLY)?.size).toBe(0)
      expect(grid.teamCharacters.get(Team.ENEMY)?.size).toBe(0)
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

    it('should return all tiles', () => {
      const tiles = grid.getAllTiles()
      expect(tiles).toHaveLength(5)
      tiles.forEach((tile) => {
        expect(tile.hex).toBeInstanceOf(Hex)
        expect(Object.values(State).includes(tile.state)).toBe(true)
      })
    })

    it('should return hex keys', () => {
      const keys = grid.keys()
      expect(keys).toHaveLength(5)
      keys.forEach((hex) => {
        expect(hex).toBeInstanceOf(Hex)
      })
    })

    it.each([
      [999, 'Hex with ID 999 not found'],
      [-1, 'Hex with ID -1 not found'],
      [0, 'Hex with ID 0 not found'],
    ])('should throw error for invalid hex ID %i', (id, expectedError) => {
      expect(() => grid.getHexById(id)).toThrow(expectedError)
      expect(() => grid.getTileById(id)).toThrow(expectedError)
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

  describe('setState()', () => {
    it('should set the tile state', () => {
      grid = new Grid(SMALL_GRID, TEST_ARENA)
      const hex = grid.getHexById(1)
      grid.setState(hex, State.BLOCKED)
      expect(grid.getTile(hex).state).toBe(State.BLOCKED)
    })
  })

  describe('edge cases', () => {
    it('should handle empty grid preset', () => {
      const emptyGrid: GridPreset = { hex: [], qOffset: [] }
      const emptyArena = { id: 1, name: 'Empty', grid: [] }
      const grid = new Grid(emptyGrid, emptyArena)

      expect(grid.getAllTiles()).toHaveLength(0)
      expect(grid.keys()).toHaveLength(0)
    })

    it('should handle invalid rows in grid preset', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const invalidGrid: GridPreset = {
        hex: [[1], undefined as unknown as number[], [2]],
        qOffset: [0, undefined as unknown as number, 0],
      }
      const simpleArena = {
        id: 1,
        name: 'Simple',
        grid: [{ type: State.DEFAULT, hex: [1, 2] }],
      }

      const grid = new Grid(invalidGrid, simpleArena)
      expect(grid.getAllTiles()).toHaveLength(2)
      expect(consoleSpy).toHaveBeenCalledWith(
        'grid: Skipping invalid row/offset in createHexesFromPreset',
        { rowIndex: 1, rowExists: false, offset: undefined },
      )
      consoleSpy.mockRestore()
    })

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

  describe('getRotatedHexId (180-degree rotation)', () => {
    it('pairs each tile with the diagonally-opposite one (1 <-> 45) and fixes the centre', () => {
      grid = new Grid()
      expect(grid.getRotatedHexId(1)).toBe(45)
      expect(grid.getRotatedHexId(45)).toBe(1)
      expect(grid.getRotatedHexId(2)).toBe(44)
      expect(grid.getRotatedHexId(23)).toBe(23) // board centre maps to itself
    })

    it('is an involution and a bijection across all 45 tiles', () => {
      grid = new Grid()
      const targets = new Set<number>()
      for (const tile of grid.getAllTiles()) {
        const id = tile.hex.getId()
        const rotated = grid.getRotatedHexId(id)
        expect(rotated).toBeDefined()
        expect(grid.getRotatedHexId(rotated!)).toBe(id)
        targets.add(rotated!)
      }
      expect(targets.size).toBe(45)
    })
  })
})

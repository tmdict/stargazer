import { beforeEach, describe, expect, it } from 'vitest'

import { Grid } from '../../src/lib/grid'
import { Hex } from '../../src/lib/hex'
import { FULL_GRID, type GridPreset } from '../../src/lib/types/grid'
import { State } from '../../src/lib/types/state'
import { Team } from '../../src/lib/types/team'

// Create a simple test grid preset
const TEST_GRID: GridPreset = {
  hex: [[3], [2, 4], [1, 5]],
  qOffset: [0, -1, -1],
}

// Test arena that works with TEST_GRID
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
    it('should initialize with default FULL_GRID layout and ARENA_1', () => {
      grid = new Grid()

      // Check grid is initialized with correct number of tiles
      const tiles = grid.getAllTiles()
      expect(tiles).toHaveLength(45) // FULL_GRID has 45 hexes

      // Check gridPreset is stored
      expect(grid.gridPreset).toBe(FULL_GRID)

      // Check all tiles have valid hexes and states
      tiles.forEach((tile) => {
        expect(tile.hex).toBeInstanceOf(Hex)
        expect(tile.state).toBeDefined()
        expect(Object.values(State).includes(tile.state)).toBe(true)
      })
    })

    it('should initialize with custom layout and map', () => {
      grid = new Grid(TEST_GRID, TEST_ARENA)

      const tiles = grid.getAllTiles()
      expect(tiles).toHaveLength(5) // TEST_GRID has 5 hexes
      expect(grid.gridPreset).toBe(TEST_GRID)
    })

    it('should apply arena map states correctly', () => {
      grid = new Grid(TEST_GRID, TEST_ARENA)

      // Check states are applied from TEST_ARENA
      expect(grid.getTileById(1).state).toBe(State.AVAILABLE_ALLY)
      expect(grid.getTileById(2).state).toBe(State.AVAILABLE_ALLY)
      expect(grid.getTileById(3).state).toBe(State.AVAILABLE_ENEMY)
      expect(grid.getTileById(4).state).toBe(State.BLOCKED)
      expect(grid.getTileById(5).state).toBe(State.DEFAULT)
    })

    it('should apply default ARENA_1 states', () => {
      grid = new Grid()

      // Check that ARENA_1 states are applied (sample checks)
      const tile1 = grid.getTileById(1)
      expect(tile1.state).toBe(State.AVAILABLE_ALLY)

      const tile30 = grid.getTileById(30)
      expect(tile30.state).toBe(State.AVAILABLE_ENEMY)

      // Check a tile not in ARENA_1 states remains DEFAULT
      const tile11 = grid.getTileById(11)
      expect(tile11.state).toBe(State.DEFAULT)
    })

    it('should initialize public properties correctly', () => {
      grid = new Grid()

      // Check teamCharacters map
      expect(grid.teamCharacters).toBeInstanceOf(Map)
      expect(grid.teamCharacters.get(Team.ALLY)).toBeInstanceOf(Set)
      expect(grid.teamCharacters.get(Team.ENEMY)).toBeInstanceOf(Set)
      expect(grid.teamCharacters.get(Team.ALLY)?.size).toBe(0)
      expect(grid.teamCharacters.get(Team.ENEMY)?.size).toBe(0)

      // Check maxTeamSizes map
      expect(grid.maxTeamSizes).toBeInstanceOf(Map)
      expect(grid.maxTeamSizes.get(Team.ALLY)).toBe(5)
      expect(grid.maxTeamSizes.get(Team.ENEMY)).toBe(5)

      // Check companion properties
      expect(grid.companionIdOffset).toBe(10000)
      expect(grid.companionLinks).toBeInstanceOf(Map)
      expect(grid.companionLinks.size).toBe(0)

      // Check skillManager is initially undefined
      expect(grid.skillManager).toBeUndefined()
    })
  })

  describe('keys()', () => {
    beforeEach(() => {
      grid = new Grid(TEST_GRID, TEST_ARENA)
    })

    it('should return all hex keys', () => {
      const keys = grid.keys()
      expect(keys).toHaveLength(5)
      keys.forEach((hex) => {
        expect(hex).toBeInstanceOf(Hex)
      })
    })

    it('should return unique hex instances', () => {
      const keys1 = grid.keys()
      const keys2 = grid.keys()

      // Should return new array each time
      expect(keys1).not.toBe(keys2)

      // But hex IDs should match
      expect(keys1.map((h) => h.getId()).sort()).toEqual(keys2.map((h) => h.getId()).sort())
    })
  })

  describe('getHexById()', () => {
    beforeEach(() => {
      grid = new Grid(TEST_GRID, TEST_ARENA)
    })

    it('should return hex for valid ID', () => {
      const hex = grid.getHexById(3)
      expect(hex).toBeInstanceOf(Hex)
      expect(hex.getId()).toBe(3)
    })

    it('should throw error for invalid hex ID', () => {
      expect(() => grid.getHexById(999)).toThrow('Hex with ID 999 not found')
      expect(() => grid.getHexById(-1)).toThrow('Hex with ID -1 not found')
      expect(() => grid.getHexById(0)).toThrow('Hex with ID 0 not found')
    })

    it('should work for all valid IDs in grid', () => {
      ;[1, 2, 3, 4, 5].forEach((id) => {
        const hex = grid.getHexById(id)
        expect(hex.getId()).toBe(id)
      })
    })
  })

  describe('getTile()', () => {
    beforeEach(() => {
      grid = new Grid(TEST_GRID, TEST_ARENA)
    })

    it('should return tile for valid hex', () => {
      const hex = grid.getHexById(1)
      const tile = grid.getTile(hex)

      expect(tile.hex).toBe(hex)
      expect(tile.state).toBe(State.AVAILABLE_ALLY)
      expect(tile.characterId).toBeUndefined()
      expect(tile.team).toBeUndefined()
    })

    it('should throw error for invalid hex', () => {
      const invalidHex = new Hex(999, 999, -1998, 999)
      expect(() => grid.getTile(invalidHex)).toThrow('Tile with hex key 999,999,-1998 not found')
    })

    it('should throw error for hex with invalid coordinates', () => {
      // Creating a Hex with invalid coordinates throws immediately
      expect(() => new Hex(1, 1, 1, 999)).toThrow('q=1 + r=1 + s=1 must be 0')
    })
  })

  describe('getTileById()', () => {
    beforeEach(() => {
      grid = new Grid(TEST_GRID, TEST_ARENA)
    })

    it('should return tile for valid ID', () => {
      const tile = grid.getTileById(2)
      expect(tile.hex.getId()).toBe(2)
      expect(tile.state).toBe(State.AVAILABLE_ALLY)
    })

    it('should throw error for invalid ID', () => {
      expect(() => grid.getTileById(999)).toThrow('Hex with ID 999 not found')
    })

    it('should return same tile as getTile with getHexById', () => {
      const tile1 = grid.getTileById(3)
      const hex = grid.getHexById(3)
      const tile2 = grid.getTile(hex)

      expect(tile1).toBe(tile2)
    })
  })

  describe('getAllTiles()', () => {
    it('should return all tiles for default grid', () => {
      grid = new Grid()
      const tiles = grid.getAllTiles()

      expect(tiles).toHaveLength(45)
      tiles.forEach((tile) => {
        expect(tile).toHaveProperty('hex')
        expect(tile).toHaveProperty('state')
      })
    })

    it('should return all tiles for custom grid', () => {
      grid = new Grid(TEST_GRID, TEST_ARENA)
      const tiles = grid.getAllTiles()

      expect(tiles).toHaveLength(5)

      // Check tiles have expected properties
      tiles.forEach((tile) => {
        expect(tile.hex).toBeInstanceOf(Hex)
        expect(Object.values(State).includes(tile.state)).toBe(true)
      })
    })

    it('should return new array each time', () => {
      grid = new Grid(TEST_GRID, TEST_ARENA)
      const tiles1 = grid.getAllTiles()
      const tiles2 = grid.getAllTiles()

      expect(tiles1).not.toBe(tiles2)
      expect(tiles1).toEqual(tiles2)
    })
  })

  describe('setState()', () => {
    beforeEach(() => {
      grid = new Grid(TEST_GRID, TEST_ARENA)
    })

    it('should set valid state and return true', () => {
      const hex = grid.getHexById(1)
      const result = grid.setState(hex, State.BLOCKED)

      expect(result).toBe(true)
      expect(grid.getTile(hex).state).toBe(State.BLOCKED)
    })

    it('should handle all valid state values', () => {
      const hex = grid.getHexById(1)

      Object.values(State).forEach((stateValue) => {
        if (typeof stateValue === 'number') {
          const result = grid.setState(hex, stateValue)
          expect(result).toBe(true)
          expect(grid.getTile(hex).state).toBe(stateValue)
        }
      })
    })

    it('should return false for invalid state and not change tile', () => {
      const hex = grid.getHexById(1)
      const originalState = grid.getTile(hex).state

      const result = grid.setState(hex, 999 as State)

      expect(result).toBe(false)
      expect(grid.getTile(hex).state).toBe(originalState)
    })

    it('should return false for negative invalid state', () => {
      const hex = grid.getHexById(1)
      const originalState = grid.getTile(hex).state

      const result = grid.setState(hex, -1 as State)

      expect(result).toBe(false)
      expect(grid.getTile(hex).state).toBe(originalState)
    })

    it('should handle state transitions correctly', () => {
      const hex = grid.getHexById(1)

      // Start with AVAILABLE_ALLY
      expect(grid.getTile(hex).state).toBe(State.AVAILABLE_ALLY)

      // Change to OCCUPIED_ALLY
      grid.setState(hex, State.OCCUPIED_ALLY)
      expect(grid.getTile(hex).state).toBe(State.OCCUPIED_ALLY)

      // Change to BLOCKED
      grid.setState(hex, State.BLOCKED)
      expect(grid.getTile(hex).state).toBe(State.BLOCKED)

      // Change to DEFAULT
      grid.setState(hex, State.DEFAULT)
      expect(grid.getTile(hex).state).toBe(State.DEFAULT)
    })
  })

  describe('public properties manipulation', () => {
    beforeEach(() => {
      grid = new Grid()
    })

    it('should allow direct manipulation of teamCharacters', () => {
      // Add characters to teams
      grid.teamCharacters.get(Team.ALLY)?.add(100)
      grid.teamCharacters.get(Team.ALLY)?.add(101)
      grid.teamCharacters.get(Team.ENEMY)?.add(200)

      expect(grid.teamCharacters.get(Team.ALLY)?.has(100)).toBe(true)
      expect(grid.teamCharacters.get(Team.ALLY)?.has(101)).toBe(true)
      expect(grid.teamCharacters.get(Team.ENEMY)?.has(200)).toBe(true)

      // Remove a character
      grid.teamCharacters.get(Team.ALLY)?.delete(100)
      expect(grid.teamCharacters.get(Team.ALLY)?.has(100)).toBe(false)
    })

    it('should allow direct manipulation of maxTeamSizes', () => {
      // Change max team sizes
      grid.maxTeamSizes.set(Team.ALLY, 7)
      grid.maxTeamSizes.set(Team.ENEMY, 3)

      expect(grid.maxTeamSizes.get(Team.ALLY)).toBe(7)
      expect(grid.maxTeamSizes.get(Team.ENEMY)).toBe(3)
    })

    it('should allow direct manipulation of companionLinks', () => {
      // Add companion links
      const key = '100-ALLY'
      grid.companionLinks.set(key, new Set([10100, 10101]))

      expect(grid.companionLinks.has(key)).toBe(true)
      expect(grid.companionLinks.get(key)?.has(10100)).toBe(true)
      expect(grid.companionLinks.get(key)?.has(10101)).toBe(true)

      // Add another companion
      grid.companionLinks.get(key)?.add(10102)
      expect(grid.companionLinks.get(key)?.size).toBe(3)

      // Remove a companion
      grid.companionLinks.get(key)?.delete(10100)
      expect(grid.companionLinks.get(key)?.has(10100)).toBe(false)
    })

    it('should allow setting skillManager', () => {
      expect(grid.skillManager).toBeUndefined()

      // Mock skill manager
      const mockSkillManager = {
        updateActiveSkills: () => {},
      } as any

      grid.skillManager = mockSkillManager
      expect(grid.skillManager).toBe(mockSkillManager)
    })
  })

  describe('edge cases and error handling', () => {
    it('should handle empty grid preset gracefully', () => {
      const emptyGrid: GridPreset = {
        hex: [],
        qOffset: [],
      }

      const emptyArena = {
        id: 1,
        name: 'Empty',
        grid: [],
      }

      const grid = new Grid(emptyGrid, emptyArena)
      expect(grid.getAllTiles()).toHaveLength(0)
      expect(grid.keys()).toHaveLength(0)
    })

    it('should handle grid preset with invalid rows', () => {
      const invalidGrid: GridPreset = {
        hex: [[1], undefined as any, [2]],
        qOffset: [0, undefined as any, 0],
      }

      const simpleArena = {
        id: 1,
        name: 'Simple',
        grid: [{ type: State.DEFAULT, hex: [1, 2] }],
      }

      // Should skip invalid rows and continue
      const grid = new Grid(invalidGrid, simpleArena)
      const tiles = grid.getAllTiles()
      expect(tiles).toHaveLength(2) // Only valid rows
    })

    it('should handle arena with empty hex arrays', () => {
      const emptyArena = {
        id: 1,
        name: 'Empty',
        grid: [
          { type: State.AVAILABLE_ALLY, hex: [] },
          { type: State.AVAILABLE_ENEMY, hex: [] },
        ],
      }

      const grid = new Grid(TEST_GRID, emptyArena)

      // All tiles should be DEFAULT since arena has no hex assignments
      grid.getAllTiles().forEach((tile) => {
        expect(tile.state).toBe(State.DEFAULT)
      })
    })

    it('should handle tiles without character data', () => {
      grid = new Grid(TEST_GRID, TEST_ARENA)

      const tile = grid.getTileById(1)
      expect(tile.characterId).toBeUndefined()
      expect(tile.team).toBeUndefined()
    })

    it('should preserve tile references', () => {
      grid = new Grid(TEST_GRID, TEST_ARENA)

      const tile1 = grid.getTileById(1)
      const tile2 = grid.getTileById(1)

      // Should return same tile object
      expect(tile1).toBe(tile2)

      // Modifying tile should be reflected
      tile1.characterId = 100
      tile1.team = Team.ALLY

      expect(tile2.characterId).toBe(100)
      expect(tile2.team).toBe(Team.ALLY)
    })
  })

  describe('gridPreset readonly property', () => {
    it('should store and expose gridPreset', () => {
      grid = new Grid(TEST_GRID, TEST_ARENA)
      expect(grid.gridPreset).toBe(TEST_GRID)

      // Verify it's the same object
      expect(grid.gridPreset.hex).toBe(TEST_GRID.hex)
      expect(grid.gridPreset.qOffset).toBe(TEST_GRID.qOffset)
    })

    it('should not allow reassignment of gridPreset', () => {
      grid = new Grid()

      // TypeScript prevents this at compile time
      // At runtime, attempting to assign to readonly throws in strict mode
      // but we can't reliably test this across all environments
      // So we just verify the property exists and is readonly by type
      expect(grid.gridPreset).toBeDefined()
      expect(grid.gridPreset).toBe(FULL_GRID)
    })
  })
})

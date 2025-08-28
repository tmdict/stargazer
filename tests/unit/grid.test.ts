import { beforeEach, describe, expect, it } from 'vitest'

import { Grid } from '../../src/lib/grid'
import { Hex } from '../../src/lib/hex'
import type { SkillManager } from '../../src/lib/skills/skill'
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
    it('should initialize with default FULL_GRID layout', () => {
      grid = new Grid()

      expect(grid.getAllTiles()).toHaveLength(45)
      expect(grid.gridPreset).toBe(FULL_GRID)
      expect(grid.teamCharacters.get(Team.ALLY)?.size).toBe(0)
      expect(grid.teamCharacters.get(Team.ENEMY)?.size).toBe(0)
      expect(grid.maxTeamSizes.get(Team.ALLY)).toBe(5)
      expect(grid.maxTeamSizes.get(Team.ENEMY)).toBe(5)
      expect(grid.companionIdOffset).toBe(10000)
      expect(grid.skillManager).toBeUndefined()
    })

    it('should initialize with custom layout and map', () => {
      grid = new Grid(TEST_GRID, TEST_ARENA)

      expect(grid.getAllTiles()).toHaveLength(5)
      expect(grid.gridPreset).toBe(TEST_GRID)

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
      grid = new Grid(TEST_GRID, TEST_ARENA)
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

    it.each([
      [999, false],
      [-1, false],
    ])('should return false for invalid state %i', (invalidState, expected) => {
      const hex = grid.getHexById(1)
      const originalState = grid.getTile(hex).state
      const result = grid.setState(hex, invalidState as State)
      expect(result).toBe(expected)
      expect(grid.getTile(hex).state).toBe(originalState)
    })

    it('should handle state transitions correctly', () => {
      const hex = grid.getHexById(1)

      expect(grid.getTile(hex).state).toBe(State.AVAILABLE_ALLY)

      grid.setState(hex, State.OCCUPIED_ALLY)
      expect(grid.getTile(hex).state).toBe(State.OCCUPIED_ALLY)

      grid.setState(hex, State.BLOCKED)
      expect(grid.getTile(hex).state).toBe(State.BLOCKED)

      grid.setState(hex, State.DEFAULT)
      expect(grid.getTile(hex).state).toBe(State.DEFAULT)
    })
  })

  describe('public properties manipulation', () => {
    beforeEach(() => {
      grid = new Grid()
    })

    it('should manipulate teamCharacters', () => {
      grid.teamCharacters.get(Team.ALLY)?.add(100)
      grid.teamCharacters.get(Team.ALLY)?.add(101)
      grid.teamCharacters.get(Team.ENEMY)?.add(200)

      expect(grid.teamCharacters.get(Team.ALLY)?.has(100)).toBe(true)
      expect(grid.teamCharacters.get(Team.ALLY)?.has(101)).toBe(true)
      expect(grid.teamCharacters.get(Team.ENEMY)?.has(200)).toBe(true)

      grid.teamCharacters.get(Team.ALLY)?.delete(100)
      expect(grid.teamCharacters.get(Team.ALLY)?.has(100)).toBe(false)
    })

    it('should manipulate maxTeamSizes', () => {
      grid.maxTeamSizes.set(Team.ALLY, 7)
      grid.maxTeamSizes.set(Team.ENEMY, 3)
      expect(grid.maxTeamSizes.get(Team.ALLY)).toBe(7)
      expect(grid.maxTeamSizes.get(Team.ENEMY)).toBe(3)
    })

    it('should manipulate companionLinks', () => {
      const key = '100-ALLY'
      grid.companionLinks.set(key, new Set([10100, 10101]))

      expect(grid.companionLinks.has(key)).toBe(true)
      expect(grid.companionLinks.get(key)?.has(10100)).toBe(true)

      grid.companionLinks.get(key)?.add(10102)
      expect(grid.companionLinks.get(key)?.size).toBe(3)
    })

    it('should set skillManager', () => {
      const mockSkillManager = { updateActiveSkills: () => {} } as SkillManager
      grid.skillManager = mockSkillManager
      expect(grid.skillManager).toBe(mockSkillManager)
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
    })

    it('should preserve tile references', () => {
      grid = new Grid(TEST_GRID, TEST_ARENA)

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

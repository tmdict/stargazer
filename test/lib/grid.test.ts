import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ARENA_1 } from '../../src/lib/arena/arena1'
import { Grid } from '../../src/lib/grid'
import { Hex } from '../../src/lib/hex'
import { clearPathfindingCache } from '../../src/lib/pathfinding'
import type { SkillManager } from '../../src/lib/skill'
import { type GridPreset } from '../../src/lib/types/grid'
import { State } from '../../src/lib/types/state'
import { Team } from '../../src/lib/types/team'

// Mock the pathfinding module
vi.mock('../../src/lib/pathfinding', () => ({
  clearPathfindingCache: vi.fn(),
}))

const mockedClearPathfindingCache = vi.mocked(clearPathfindingCache)

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
    { type: State.BLOCKED, hex: [] },
    { type: State.BLOCKED_BREAKABLE, hex: [] },
  ],
}

describe('Grid', () => {
  let grid: Grid

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('constructor and initialization', () => {
    it('should initialize with default FULL_GRID layout', () => {
      grid = new Grid()
      const tiles = grid.getAllTiles()
      expect(tiles).toHaveLength(45) // FULL_GRID has 45 hexes
      tiles.forEach((tile) => {
        expect(tile.hex).toBeInstanceOf(Hex)
        expect(tile.state).toBeDefined()
      })
    })

    it('should initialize with custom layout', () => {
      grid = new Grid(TEST_GRID, TEST_ARENA)
      const tiles = grid.getAllTiles()
      expect(tiles).toHaveLength(5) // TEST_GRID has 5 hexes
    })

    it('should apply arena map states', () => {
      grid = new Grid()

      // Check that ARENA_1 states are applied
      const tile1 = grid.getTileById(1)
      expect(tile1.state).toBe(State.AVAILABLE_ALLY)

      const tile30 = grid.getTileById(30)
      expect(tile30.state).toBe(State.AVAILABLE_ENEMY)

      // Check a tile not in ARENA_1 states remains DEFAULT
      const tile11 = grid.getTileById(11)
      expect(tile11.state).toBe(State.DEFAULT)
    })
  })

  describe('basic tile and hex access', () => {
    beforeEach(() => {
      grid = new Grid(TEST_GRID, TEST_ARENA)
    })

    it('should set and get tile state', () => {
      const hex = grid.getHexById(1)
      grid.setState(hex, State.BLOCKED)
      const tile = grid.getTile(hex)
      expect(tile.state).toBe(State.BLOCKED)
    })

    it('should get all hex keys', () => {
      const keys = grid.keys()
      expect(keys).toHaveLength(5)
      keys.forEach((hex) => {
        expect(hex).toBeInstanceOf(Hex)
      })
    })

    it('should get hex by valid ID', () => {
      const hex = grid.getHexById(3)
      expect(hex).toBeInstanceOf(Hex)
      expect(hex.getId()).toBe(3)
    })

    it('should throw error for invalid hex ID', () => {
      expect(() => grid.getHexById(999)).toThrow('Hex with ID 999 not found')
    })

    it('should get tile by hex', () => {
      const hex = grid.getHexById(1)
      const tile = grid.getTile(hex)
      expect(tile.hex).toBe(hex)
      expect(tile.state).toBeDefined()
    })

    it('should throw error for invalid hex key', () => {
      const invalidHex = new Hex(999, 999, -1998)
      expect(() => grid.getTile(invalidHex)).toThrow()
    })

    it('should get tile by ID', () => {
      const tile = grid.getTileById(2)
      expect(tile.hex.getId()).toBe(2)
    })

    it('should get all tiles', () => {
      const tiles = grid.getAllTiles()
      expect(tiles).toHaveLength(5)
    })

    it('should filter tiles with characters', () => {
      grid.placeCharacter(1, 100, Team.ALLY)
      // Tile 2 is AVAILABLE_ALLY in TEST_ARENA, can't place ENEMY there
      grid.placeCharacter(3, 200, Team.ENEMY)

      const tilesWithChars = grid.getTilesWithCharacters()
      expect(tilesWithChars).toHaveLength(2)
      expect(tilesWithChars[0].characterId).toBeDefined()
      expect(tilesWithChars[1].characterId).toBeDefined()
    })
  })

  describe('character query methods', () => {
    beforeEach(() => {
      grid = new Grid()
    })

    it('should get character from hex', () => {
      grid.placeCharacter(1, 100, Team.ALLY)
      expect(grid.getCharacter(1)).toBe(100)
      expect(grid.getCharacter(2)).toBeUndefined()
    })

    it('should check if hex has character', () => {
      grid.placeCharacter(1, 100, Team.ALLY)
      expect(grid.hasCharacter(1)).toBe(true)
      expect(grid.hasCharacter(2)).toBe(false)
    })

    it('should get character team', () => {
      grid.placeCharacter(1, 100, Team.ALLY)
      grid.placeCharacter(30, 200, Team.ENEMY)
      expect(grid.getCharacterTeam(1)).toBe(Team.ALLY)
      expect(grid.getCharacterTeam(30)).toBe(Team.ENEMY)
      expect(grid.getCharacterTeam(2)).toBeUndefined()
    })

    it('should count all characters', () => {
      expect(grid.getCharacterCount()).toBe(0)
      grid.placeCharacter(1, 100, Team.ALLY)
      expect(grid.getCharacterCount()).toBe(1)
      grid.placeCharacter(30, 200, Team.ENEMY)
      expect(grid.getCharacterCount()).toBe(2)
    })

    it('should get character placements map', () => {
      grid.placeCharacter(1, 100, Team.ALLY)
      grid.placeCharacter(30, 200, Team.ENEMY)

      const placements = grid.getCharacterPlacements()
      expect(placements.size).toBe(2)
      expect(placements.get(1)).toBe(100)
      expect(placements.get(30)).toBe(200)
    })

    it('should find character hex', () => {
      grid.placeCharacter(1, 100, Team.ALLY)
      grid.placeCharacter(30, 200, Team.ENEMY)

      expect(grid.findCharacterHex(100)).toBe(1)
      expect(grid.findCharacterHex(200)).toBe(30)
      expect(grid.findCharacterHex(999)).toBeNull()
    })

    it('should find character hex filtered by team', () => {
      grid.placeCharacter(1, 100, Team.ALLY)

      expect(grid.findCharacterHex(100, Team.ALLY)).toBe(1)
      expect(grid.findCharacterHex(100, Team.ENEMY)).toBeNull()
    })
  })

  describe('team management', () => {
    beforeEach(() => {
      grid = new Grid()
    })

    it('should get and set max team size', () => {
      expect(grid.getMaxTeamSize(Team.ALLY)).toBe(5)
      grid.setMaxTeamSize(Team.ALLY, 3)
      expect(grid.getMaxTeamSize(Team.ALLY)).toBe(3)
      expect(grid.getMaxTeamSize(Team.ENEMY)).toBe(5)
    })

    it('should check if character can be placed', () => {
      expect(grid.canPlaceCharacter(100, Team.ALLY)).toBe(true)
      grid.placeCharacter(1, 100, Team.ALLY)
      expect(grid.canPlaceCharacter(100, Team.ALLY)).toBe(false) // Already placed
      expect(grid.canPlaceCharacter(200, Team.ALLY)).toBe(true)
    })

    it('should respect team size limits', () => {
      grid.setMaxTeamSize(Team.ALLY, 2)

      expect(grid.canPlaceCharacter(100, Team.ALLY)).toBe(true)
      grid.placeCharacter(1, 100, Team.ALLY)

      expect(grid.canPlaceCharacter(200, Team.ALLY)).toBe(true)
      grid.placeCharacter(2, 200, Team.ALLY)

      expect(grid.canPlaceCharacter(300, Team.ALLY)).toBe(false) // Team full
    })

    it('should check if character can be placed on tile', () => {
      expect(grid.canPlaceCharacterOnTile(1, Team.ALLY)).toBe(true)
      expect(grid.canPlaceCharacterOnTile(30, Team.ALLY)).toBe(false)
      expect(grid.canPlaceCharacterOnTile(30, Team.ENEMY)).toBe(true)
      expect(grid.canPlaceCharacterOnTile(1, Team.ENEMY)).toBe(false)

      // Tile without available state
      expect(grid.canPlaceCharacterOnTile(20, Team.ALLY)).toBe(false)
    })

    it('should get team characters', () => {
      const allyChars = grid.getTeamCharacters(Team.ALLY)
      expect(allyChars.size).toBe(0)

      grid.placeCharacter(1, 100, Team.ALLY)
      grid.placeCharacter(2, 200, Team.ALLY)
      grid.placeCharacter(30, 300, Team.ENEMY)

      const allyCharsAfter = grid.getTeamCharacters(Team.ALLY)
      expect(allyCharsAfter.size).toBe(2)
      expect(allyCharsAfter.has(100)).toBe(true)
      expect(allyCharsAfter.has(200)).toBe(true)

      const enemyChars = grid.getTeamCharacters(Team.ENEMY)
      expect(enemyChars.size).toBe(1)
      expect(enemyChars.has(300)).toBe(true)
    })
  })

  describe('character placement and removal', () => {
    beforeEach(() => {
      grid = new Grid()
    })

    it('should place character on available tile', () => {
      const result = grid.placeCharacter(1, 100, Team.ALLY)
      expect(result).toBe(true)
      expect(grid.getCharacter(1)).toBe(100)
      expect(grid.getCharacterTeam(1)).toBe(Team.ALLY)
      expect(grid.getTileById(1).state).toBe(State.OCCUPIED_ALLY)
      expect(mockedClearPathfindingCache).toHaveBeenCalled()
    })

    it('should not place character on unavailable tile', () => {
      const result = grid.placeCharacter(30, 100, Team.ALLY)
      expect(result).toBe(false)
      expect(grid.getCharacter(30)).toBeUndefined()
    })

    it('should replace existing character', () => {
      grid.placeCharacter(1, 100, Team.ALLY)
      const result = grid.placeCharacter(1, 200, Team.ALLY)
      expect(result).toBe(true)
      expect(grid.getCharacter(1)).toBe(200)
      expect(grid.getTeamCharacters(Team.ALLY).has(100)).toBe(false)
      expect(grid.getTeamCharacters(Team.ALLY).has(200)).toBe(true)
    })

    it('should skip cache invalidation when requested', () => {
      vi.clearAllMocks()
      grid.placeCharacter(1, 100, Team.ALLY, true)
      expect(mockedClearPathfindingCache).not.toHaveBeenCalled()
    })

    it('should remove character from hex', () => {
      grid.placeCharacter(1, 100, Team.ALLY)
      grid.removeCharacter(1)

      expect(grid.getCharacter(1)).toBeUndefined()
      expect(grid.getCharacterTeam(1)).toBeUndefined()
      expect(grid.getTileById(1).state).toBe(State.AVAILABLE_ALLY)
      expect(grid.getTeamCharacters(Team.ALLY).has(100)).toBe(false)
    })

    it('should handle removing non-existent character', () => {
      expect(() => grid.removeCharacter(1)).not.toThrow()
    })

    it('should clear all characters', () => {
      grid.placeCharacter(1, 100, Team.ALLY)
      grid.placeCharacter(2, 200, Team.ALLY)
      grid.placeCharacter(30, 300, Team.ENEMY)

      const result = grid.clearAllCharacters()
      expect(result).toBe(true)
      expect(grid.getCharacterCount()).toBe(0)
      expect(grid.getTeamCharacters(Team.ALLY).size).toBe(0)
      expect(grid.getTeamCharacters(Team.ENEMY).size).toBe(0)
    })

    it('should auto place character on random available tile', () => {
      const result = grid.autoPlaceCharacter(100, Team.ALLY)
      expect(result).toBe(true)

      const hex = grid.findCharacterHex(100)
      expect(hex).not.toBeNull()
      expect(grid.getCharacterTeam(hex!)).toBe(Team.ALLY)
    })

    it('should not auto place when no tiles available', () => {
      // Fill all ally tiles
      const allyTiles = [1, 2, 3, 4, 5]
      allyTiles.forEach((id, index) => {
        grid.placeCharacter(id, 100 + index, Team.ALLY)
      })

      const result = grid.autoPlaceCharacter(999, Team.ALLY)
      expect(result).toBe(false)
    })

    it('should not auto place when team is full', () => {
      grid.setMaxTeamSize(Team.ALLY, 1)
      grid.placeCharacter(1, 100, Team.ALLY)

      const result = grid.autoPlaceCharacter(200, Team.ALLY)
      expect(result).toBe(false)
    })
  })

  describe('complex operations', () => {
    beforeEach(() => {
      grid = new Grid()
    })

    describe('swapCharacters', () => {
      it('should swap two characters', () => {
        grid.placeCharacter(1, 100, Team.ALLY)
        grid.placeCharacter(2, 200, Team.ALLY)

        const result = grid.swapCharacters(1, 2)
        expect(result).toBe(true)
        expect(grid.getCharacter(1)).toBe(200)
        expect(grid.getCharacter(2)).toBe(100)
      })

      it('should swap characters from different teams', () => {
        grid.placeCharacter(1, 100, Team.ALLY)
        grid.placeCharacter(30, 200, Team.ENEMY)

        const result = grid.swapCharacters(1, 30)
        expect(result).toBe(true)
        expect(grid.getCharacter(1)).toBe(200)
        expect(grid.getCharacter(30)).toBe(100)
        expect(grid.getCharacterTeam(1)).toBe(Team.ALLY)
        expect(grid.getCharacterTeam(30)).toBe(Team.ENEMY)
      })

      it('should not swap same position', () => {
        grid.placeCharacter(1, 100, Team.ALLY)
        const result = grid.swapCharacters(1, 1)
        expect(result).toBe(false)
      })

      it('should not swap when position has no character', () => {
        grid.placeCharacter(1, 100, Team.ALLY)
        const result = grid.swapCharacters(1, 2)
        expect(result).toBe(false)
        expect(grid.getCharacter(1)).toBe(100) // Unchanged
      })
    })

    describe('moveCharacter', () => {
      it('should move character to empty tile', () => {
        grid.placeCharacter(1, 100, Team.ALLY)

        const result = grid.moveCharacter(1, 2, 100)
        expect(result).toBe(true)
        expect(grid.getCharacter(1)).toBeUndefined()
        expect(grid.getCharacter(2)).toBe(100)
      })

      it('should move to occupied tile by replacing', () => {
        grid.placeCharacter(1, 100, Team.ALLY)
        grid.placeCharacter(2, 200, Team.ALLY)

        // moveCharacter will succeed by replacing existing character
        const result = grid.moveCharacter(1, 2, 100)
        expect(result).toBe(true)
        expect(grid.getCharacter(1)).toBeUndefined()
        expect(grid.getCharacter(2)).toBe(100) // Replaced
      })

      it('should not move to same position', () => {
        grid.placeCharacter(1, 100, Team.ALLY)
        const result = grid.moveCharacter(1, 1, 100)
        expect(result).toBe(false)
      })

      it('should not move from empty position', () => {
        // No character at position 1, moveCharacter properly validates characterId
        const result = grid.moveCharacter(1, 2, 100)
        expect(result).toBe(false)
        expect(grid.getCharacter(2)).toBeUndefined()
      })

      it('should not move character when characterId does not match', () => {
        grid.placeCharacter(1, 100, Team.ALLY)
        grid.placeCharacter(2, 200, Team.ALLY)

        // Try to move character 200 from position 1 (which has character 100)
        const result = grid.moveCharacter(1, 3, 200)
        expect(result).toBe(false)

        // Characters should remain in original positions
        expect(grid.getCharacter(1)).toBe(100)
        expect(grid.getCharacter(2)).toBe(200)
        expect(grid.getCharacter(3)).toBeUndefined()
      })

      it('should handle cross-team moves', () => {
        grid.placeCharacter(1, 100, Team.ALLY)

        const result = grid.moveCharacter(1, 30, 100)
        expect(result).toBe(true)
        expect(grid.getCharacter(30)).toBe(100)
        expect(grid.getCharacterTeam(30)).toBe(Team.ENEMY)
      })
    })
  })

  describe('companion support', () => {
    beforeEach(() => {
      grid = new Grid()
    })

    it('should identify companion IDs', () => {
      expect(grid.isCompanionId(100)).toBe(false)
      expect(grid.isCompanionId(10000)).toBe(true)
      expect(grid.isCompanionId(10100)).toBe(true)
    })

    it('should get main character ID from companion', () => {
      expect(grid.getMainCharacterId(10100)).toBe(100)
      expect(grid.getMainCharacterId(20200)).toBe(200)
      expect(grid.getMainCharacterId(100)).toBe(100) // Already main
    })

    it('should manage companion links', () => {
      grid.addCompanionLink(100, 10100, Team.ALLY)
      grid.addCompanionLink(100, 10101, Team.ALLY)
      grid.addCompanionLink(100, 10100, Team.ENEMY)

      const allyCompanions = grid.getCompanions(100, Team.ALLY)
      expect(allyCompanions.size).toBe(2)
      expect(allyCompanions.has(10100)).toBe(true)
      expect(allyCompanions.has(10101)).toBe(true)

      const enemyCompanions = grid.getCompanions(100, Team.ENEMY)
      expect(enemyCompanions.size).toBe(1)
      expect(enemyCompanions.has(10100)).toBe(true)

      // getCompanions without team returns unique companion IDs across all teams
      const allCompanions = grid.getCompanions(100)
      expect(allCompanions.size).toBe(2) // 10100 and 10101
    })

    it('should remove companion links', () => {
      grid.addCompanionLink(100, 10100, Team.ALLY)
      grid.addCompanionLink(100, 10101, Team.ALLY)

      grid.removeCompanionLink(100, 10100, Team.ALLY)

      const companions = grid.getCompanions(100, Team.ALLY)
      expect(companions.size).toBe(1)
      expect(companions.has(10101)).toBe(true)
      expect(companions.has(10100)).toBe(false)
    })

    it('should clear companion links', () => {
      grid.addCompanionLink(100, 10100, Team.ALLY)
      grid.addCompanionLink(100, 10101, Team.ALLY)
      grid.addCompanionLink(100, 10100, Team.ENEMY)

      grid.clearCompanionLinks(100, Team.ALLY)

      expect(grid.getCompanions(100, Team.ALLY).size).toBe(0)
      expect(grid.getCompanions(100, Team.ENEMY).size).toBe(1)

      grid.clearCompanionLinks(100)
      expect(grid.getCompanions(100).size).toBe(0)
    })

    it('should remove linked characters', () => {
      // Place main and companions
      grid.placeCharacter(1, 100, Team.ALLY)
      grid.placeCharacter(2, 10100, Team.ALLY)
      grid.placeCharacter(3, 10101, Team.ALLY)
      grid.addCompanionLink(100, 10100, Team.ALLY)
      grid.addCompanionLink(100, 10101, Team.ALLY)

      grid.removeLinkedCharacters(100, Team.ALLY)

      expect(grid.getCharacter(1)).toBeUndefined()
      expect(grid.getCharacter(2)).toBeUndefined()
      expect(grid.getCharacter(3)).toBeUndefined()
      expect(grid.getCompanions(100, Team.ALLY).size).toBe(0)
    })

    it('should remove linked characters when removing companion', () => {
      // Place main and companions
      grid.placeCharacter(1, 100, Team.ALLY)
      grid.placeCharacter(2, 10100, Team.ALLY)
      grid.placeCharacter(3, 10101, Team.ALLY)
      grid.addCompanionLink(100, 10100, Team.ALLY)
      grid.addCompanionLink(100, 10101, Team.ALLY)

      // Remove via companion ID
      grid.removeLinkedCharacters(10100, Team.ALLY)

      expect(grid.getCharacter(1)).toBeUndefined()
      expect(grid.getCharacter(2)).toBeUndefined()
      expect(grid.getCharacter(3)).toBeUndefined()
      expect(grid.getCompanions(100, Team.ALLY).size).toBe(0)
    })
  })

  describe('transaction support', () => {
    beforeEach(() => {
      grid = new Grid()
    })

    it('should execute successful transaction', () => {
      const operations = [
        () => {
          grid.placeCharacter(1, 100, Team.ALLY, true)
          return true
        },
        () => {
          grid.placeCharacter(2, 200, Team.ALLY, true)
          return true
        },
      ]

      vi.clearAllMocks()
      const result = grid.executeTransaction(operations)

      expect(result).toBe(true)
      expect(grid.getCharacter(1)).toBe(100)
      expect(grid.getCharacter(2)).toBe(200)
      // Even with skipCacheInvalidation=true in operations,
      // pendingCacheClears is set to false at start of transaction
      // and cache is not cleared since no operations triggered it
      expect(mockedClearPathfindingCache).not.toHaveBeenCalled()
    })

    it('should rollback failed transaction', () => {
      grid.placeCharacter(1, 100, Team.ALLY)

      const operations = [
        () => {
          grid.removeCharacter(1, true)
          return true
        },
        () => {
          // This will fail
          return false
        },
      ]

      const rollbacks = [
        () => {
          grid.placeCharacter(1, 100, Team.ALLY, true)
        },
      ]

      const result = grid.executeTransaction(operations, rollbacks)

      expect(result).toBe(false)
      expect(grid.getCharacter(1)).toBe(100) // Restored
    })

    it('should batch cache invalidations during transaction', () => {
      const operations = [
        () => {
          grid.placeCharacter(1, 100, Team.ALLY, true)
          return true
        },
        () => {
          grid.placeCharacter(2, 200, Team.ALLY, true)
          return true
        },
        () => {
          grid.removeCharacter(1, true)
          return true
        },
      ]

      vi.clearAllMocks()
      grid.executeTransaction(operations)

      // Operations with skipCacheInvalidation=true don't set pendingCacheClears
      expect(mockedClearPathfindingCache).not.toHaveBeenCalled()
    })
  })

  describe('cache and skill manager integration', () => {
    let mockSkillManager: SkillManager

    beforeEach(() => {
      grid = new Grid()
      mockSkillManager = {
        updateActiveSkills: vi.fn(),
      } as unknown as SkillManager
      grid.skillManager = mockSkillManager
    })

    it('should trigger skill manager updates on placement', () => {
      grid.placeCharacter(1, 100, Team.ALLY)
      expect(mockSkillManager.updateActiveSkills).toHaveBeenCalledWith(grid)
    })

    it('should trigger skill manager updates on removal', () => {
      grid.placeCharacter(1, 100, Team.ALLY)
      vi.clearAllMocks()

      grid.removeCharacter(1)
      expect(mockSkillManager.updateActiveSkills).toHaveBeenCalledWith(grid)
    })

    it('should not trigger skill manager when skipping cache invalidation', () => {
      vi.clearAllMocks()
      grid.placeCharacter(1, 100, Team.ALLY, true)
      expect(mockSkillManager.updateActiveSkills).not.toHaveBeenCalled()
    })

    it('should trigger skill manager after successful transaction', () => {
      const operations = [
        () => {
          grid.placeCharacter(1, 100, Team.ALLY, true)
          return true
        },
      ]

      vi.clearAllMocks()
      grid.executeTransaction(operations)
      expect(mockSkillManager.updateActiveSkills).toHaveBeenCalledOnce()
    })
  })

  describe('edge cases and error handling', () => {
    beforeEach(() => {
      grid = new Grid(TEST_GRID, TEST_ARENA)
    })

    it('should handle operations on edge hex IDs', () => {
      const tile1 = grid.getTileById(1)
      expect(tile1).toBeDefined()

      const tile5 = grid.getTileById(5)
      expect(tile5).toBeDefined()
    })

    it('should maintain state consistency after failed operations', () => {
      grid.placeCharacter(1, 100, Team.ALLY)
      const initialState = grid.getTileById(1).state

      // Try to place on non-available tile
      grid.placeCharacter(2, 200, Team.ENEMY)

      // State should remain unchanged
      expect(grid.getTileById(1).state).toBe(initialState)
      expect(grid.getCharacter(1)).toBe(100)
    })

    it('should handle concurrent team operations', () => {
      grid.placeCharacter(1, 100, Team.ALLY)
      grid.placeCharacter(3, 200, Team.ENEMY)

      expect(grid.getTeamCharacters(Team.ALLY).size).toBe(1)
      expect(grid.getTeamCharacters(Team.ENEMY).size).toBe(1)

      grid.clearAllCharacters()

      expect(grid.getTeamCharacters(Team.ALLY).size).toBe(0)
      expect(grid.getTeamCharacters(Team.ENEMY).size).toBe(0)
    })
  })

  describe('input validation', () => {
    beforeEach(() => {
      grid = new Grid()
    })

    it('should not set invalid team sizes', () => {
      const originalSize = grid.getMaxTeamSize(Team.ALLY)

      grid.setMaxTeamSize(Team.ALLY, 0)
      expect(grid.getMaxTeamSize(Team.ALLY)).toBe(originalSize) // Unchanged

      grid.setMaxTeamSize(Team.ALLY, -5)
      expect(grid.getMaxTeamSize(Team.ALLY)).toBe(originalSize) // Unchanged

      grid.setMaxTeamSize(Team.ALLY, 1.5)
      expect(grid.getMaxTeamSize(Team.ALLY)).toBe(originalSize) // Unchanged

      grid.setMaxTeamSize(Team.ALLY, 1000) // More than grid tiles (45)
      expect(grid.getMaxTeamSize(Team.ALLY)).toBe(originalSize) // Unchanged

      grid.setMaxTeamSize(Team.ALLY, 3) // Valid
      expect(grid.getMaxTeamSize(Team.ALLY)).toBe(3)

      grid.setMaxTeamSize(Team.ALLY, 45) // Valid - exactly the number of tiles
      expect(grid.getMaxTeamSize(Team.ALLY)).toBe(45)
    })

    it('should not set invalid states', () => {
      const hex = grid.getHexById(1)
      const originalState = grid.getTile(hex).state

      grid.setState(hex, 999 as State)
      expect(grid.getTile(hex).state).toBe(originalState) // Unchanged

      grid.setState(hex, -1 as State)
      expect(grid.getTile(hex).state).toBe(originalState) // Unchanged

      grid.setState(hex, State.BLOCKED) // Valid
      expect(grid.getTile(hex).state).toBe(State.BLOCKED)
    })

    it('should not place character with invalid ID', () => {
      const result1 = grid.placeCharacter(1, 0, Team.ALLY)
      expect(result1).toBe(false)
      expect(grid.getCharacter(1)).toBeUndefined()

      const result2 = grid.placeCharacter(1, -1, Team.ALLY)
      expect(result2).toBe(false)
      expect(grid.getCharacter(1)).toBeUndefined()

      const result3 = grid.placeCharacter(1, 1.5, Team.ALLY)
      expect(result3).toBe(false)
      expect(grid.getCharacter(1)).toBeUndefined()

      const result4 = grid.placeCharacter(1, 100, Team.ALLY) // Valid
      expect(result4).toBe(true)
      expect(grid.getCharacter(1)).toBe(100)
    })
  })
})

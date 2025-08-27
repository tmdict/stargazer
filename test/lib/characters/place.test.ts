import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  executeAutoPlaceCharacter,
  executePlaceCharacter,
  performPlace,
} from '../../../src/lib/characters/place'
import { Grid } from '../../../src/lib/grid'
// Import hasSkill directly for mocking
import { hasSkill, SkillManager } from '../../../src/lib/skills/skill'
import type { GridPreset } from '../../../src/lib/types/grid'
import { State } from '../../../src/lib/types/state'
import { Team } from '../../../src/lib/types/team'

// Mock hasSkill to control skill behavior
vi.mock('../../../src/lib/skills/skill', () => ({
  hasSkill: vi.fn(),
  SkillManager: vi.fn(),
}))

// Don't mock performRemove globally - import the real implementation

// Create a simple test grid preset
const TEST_GRID: GridPreset = {
  hex: [[3], [2, 4], [1, 5], [6, 7]],
  qOffset: [0, -1, -1, -2],
}

// Test arena that works with TEST_GRID
const TEST_ARENA = {
  id: 1,
  name: 'Test',
  grid: [
    { type: State.AVAILABLE_ALLY, hex: [1, 2, 3] },
    { type: State.AVAILABLE_ENEMY, hex: [4, 5] },
    { type: State.BLOCKED, hex: [6] },
    { type: State.DEFAULT, hex: [7] },
  ],
}

describe('place.ts', () => {
  let grid: Grid
  let skillManager: SkillManager

  beforeEach(() => {
    grid = new Grid(TEST_GRID, TEST_ARENA)

    // Reset mocks
    vi.clearAllMocks()

    // Create mock skill manager
    skillManager = {
      activateCharacterSkill: vi.fn().mockReturnValue(true),
      deactivateCharacterSkill: vi.fn(),
      updateActiveSkills: vi.fn(),
    } as unknown as SkillManager

    // Set skillManager on grid for some tests
    grid.skillManager = skillManager

    // Default: characters don't have skills
    vi.mocked(hasSkill).mockReturnValue(false)
  })

  describe('performPlace', () => {
    it('should successfully place character on available ally tile', () => {
      const result = performPlace(grid, 1, 100, Team.ALLY)

      expect(result).toBe(true)
      const tile = grid.getTileById(1)
      expect(tile.characterId).toBe(100)
      expect(tile.team).toBe(Team.ALLY)
      expect(tile.state).toBe(State.OCCUPIED_ALLY)
      expect(grid.teamCharacters.get(Team.ALLY)?.has(100)).toBe(true)
    })

    it('should successfully place character on available enemy tile', () => {
      const result = performPlace(grid, 4, 200, Team.ENEMY)

      expect(result).toBe(true)
      const tile = grid.getTileById(4)
      expect(tile.characterId).toBe(200)
      expect(tile.team).toBe(Team.ENEMY)
      expect(tile.state).toBe(State.OCCUPIED_ENEMY)
      expect(grid.teamCharacters.get(Team.ENEMY)?.has(200)).toBe(true)
    })

    it('should replace existing character on occupied tile', () => {
      // First placement
      performPlace(grid, 1, 100, Team.ALLY)
      expect(grid.teamCharacters.get(Team.ALLY)?.has(100)).toBe(true)

      // Second placement replaces first
      const result = performPlace(grid, 1, 200, Team.ALLY)

      expect(result).toBe(true)
      const tile = grid.getTileById(1)
      expect(tile.characterId).toBe(200)
      expect(grid.teamCharacters.get(Team.ALLY)?.has(100)).toBe(false)
      expect(grid.teamCharacters.get(Team.ALLY)?.has(200)).toBe(true)
    })

    it('should reject invalid character ID', () => {
      expect(performPlace(grid, 1, 0, Team.ALLY)).toBe(false)
      expect(performPlace(grid, 1, -1, Team.ALLY)).toBe(false)
      expect(performPlace(grid, 1, 1.5, Team.ALLY)).toBe(false)
      expect(performPlace(grid, 1, NaN, Team.ALLY)).toBe(false)
    })

    it('should reject placement on wrong team tile', () => {
      // Try to place ally on enemy tile
      expect(performPlace(grid, 4, 100, Team.ALLY)).toBe(false)

      // Try to place enemy on ally tile
      expect(performPlace(grid, 1, 200, Team.ENEMY)).toBe(false)
    })

    it('should reject placement on blocked tile', () => {
      expect(performPlace(grid, 6, 100, Team.ALLY)).toBe(false)
      expect(performPlace(grid, 6, 200, Team.ENEMY)).toBe(false)
    })

    it('should reject placement on default tile', () => {
      expect(performPlace(grid, 7, 100, Team.ALLY)).toBe(false)
      expect(performPlace(grid, 7, 200, Team.ENEMY)).toBe(false)
    })

    it('should enforce team size limits', () => {
      // Set team size limit to 2
      grid.maxTeamSizes.set(Team.ALLY, 2)

      // Place two characters successfully
      expect(performPlace(grid, 1, 100, Team.ALLY)).toBe(true)
      expect(performPlace(grid, 2, 200, Team.ALLY)).toBe(true)

      // Third placement should fail due to team size limit
      expect(performPlace(grid, 3, 300, Team.ALLY)).toBe(false)
    })

    it('should prevent duplicate character on same team', () => {
      // Place character once
      expect(performPlace(grid, 1, 100, Team.ALLY)).toBe(true)

      // Try to place same character again on same team
      expect(performPlace(grid, 2, 100, Team.ALLY)).toBe(false)
    })

    it('should allow same character ID on different teams', () => {
      // Place character on ally team
      expect(performPlace(grid, 1, 100, Team.ALLY)).toBe(true)

      // Place same character ID on enemy team should work
      expect(performPlace(grid, 4, 100, Team.ENEMY)).toBe(true)

      expect(grid.teamCharacters.get(Team.ALLY)?.has(100)).toBe(true)
      expect(grid.teamCharacters.get(Team.ENEMY)?.has(100)).toBe(true)
    })

    it('should handle skipCacheInvalidation parameter', () => {
      // Just verify the parameter is accepted without testing cache internals
      const result1 = performPlace(grid, 1, 100, Team.ALLY, false)
      expect(result1).toBe(true)

      const result2 = performPlace(grid, 2, 200, Team.ALLY, true)
      expect(result2).toBe(true)
    })

    it('should handle occupied tile with missing team gracefully', () => {
      // Manually create invalid state
      const tile = grid.getTileById(1)
      tile.characterId = 999
      tile.team = undefined

      // Should log error and fail
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const result = performPlace(grid, 1, 100, Team.ALLY)

      expect(result).toBe(false)
      expect(consoleSpy).toHaveBeenCalledWith('Tile has characterId 999 but no team')

      consoleSpy.mockRestore()
    })
  })

  describe('executePlaceCharacter', () => {
    it('should successfully place character without skill', () => {
      const result = executePlaceCharacter(grid, skillManager, 1, 100, Team.ALLY)

      expect(result).toBe(true)
      const tile = grid.getTileById(1)
      expect(tile.characterId).toBe(100)
      expect(tile.team).toBe(Team.ALLY)
      expect(skillManager.activateCharacterSkill).not.toHaveBeenCalled()
    })

    it('should successfully place character with skill', () => {
      vi.mocked(hasSkill).mockReturnValue(true)

      const result = executePlaceCharacter(grid, skillManager, 1, 100, Team.ALLY)

      expect(result).toBe(true)
      expect(skillManager.activateCharacterSkill).toHaveBeenCalledWith(100, 1, Team.ALLY, grid)
      expect(skillManager.updateActiveSkills).toHaveBeenCalledWith(grid)
    })

    it('should reject companion IDs', () => {
      const companionId = grid.companionIdOffset + 1
      const result = executePlaceCharacter(grid, skillManager, 1, companionId, Team.ALLY)

      expect(result).toBe(false)
      const tile = grid.getTileById(1)
      expect(tile.characterId).toBeUndefined()
    })

    it('should rollback on skill activation failure', () => {
      vi.mocked(hasSkill).mockReturnValue(true)
      skillManager.activateCharacterSkill = vi.fn().mockReturnValue(false)

      const result = executePlaceCharacter(grid, skillManager, 1, 100, Team.ALLY)

      expect(result).toBe(false)
      const tile = grid.getTileById(1)
      expect(tile.characterId).toBeUndefined()
      expect(tile.state).toBe(State.AVAILABLE_ALLY)
    })

    it('should handle rollback failure gracefully', () => {
      vi.mocked(hasSkill).mockReturnValue(true)
      skillManager.activateCharacterSkill = vi.fn().mockReturnValue(false)

      // Mock console.warn
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      // The rollback in executePlaceCharacter will succeed, so we won't see a warning
      // This test just verifies the rollback path is executed
      const result = executePlaceCharacter(grid, skillManager, 1, 100, Team.ALLY)

      expect(result).toBe(false)
      // Verify character was rolled back
      const tile = grid.getTileById(1)
      expect(tile.characterId).toBeUndefined()

      consoleSpy.mockRestore()
    })

    it('should use default team ALLY when not specified', () => {
      const result = executePlaceCharacter(grid, skillManager, 1, 100)

      expect(result).toBe(true)
      const tile = grid.getTileById(1)
      expect(tile.team).toBe(Team.ALLY)
    })
  })

  describe('executeAutoPlaceCharacter', () => {
    it('should place character on random available tile', () => {
      const result = executeAutoPlaceCharacter(grid, skillManager, 100, Team.ALLY)

      expect(result).toBe(true)

      // Check character was placed on one of the ally tiles (1, 2, or 3)
      const placedHex = [1, 2, 3].find((hexId) => grid.getTileById(hexId).characterId === 100)
      expect(placedHex).toBeDefined()
    })

    it('should reject when character cannot be placed on team', () => {
      // Fill team to capacity
      grid.maxTeamSizes.set(Team.ALLY, 2)
      grid.teamCharacters.get(Team.ALLY)?.add(100)
      grid.teamCharacters.get(Team.ALLY)?.add(200)

      const result = executeAutoPlaceCharacter(grid, skillManager, 300, Team.ALLY)

      expect(result).toBe(false)
    })

    it('should reject when no tiles available', () => {
      // Place characters on all available ally tiles
      performPlace(grid, 1, 100, Team.ALLY)
      performPlace(grid, 2, 200, Team.ALLY)
      performPlace(grid, 3, 300, Team.ALLY)

      const result = executeAutoPlaceCharacter(grid, skillManager, 400, Team.ALLY)

      expect(result).toBe(false)
    })

    it('should activate skill after placement', () => {
      vi.mocked(hasSkill).mockReturnValue(true)

      const result = executeAutoPlaceCharacter(grid, skillManager, 100, Team.ALLY)

      expect(result).toBe(true)
      expect(skillManager.activateCharacterSkill).toHaveBeenCalled()
      expect(skillManager.updateActiveSkills).toHaveBeenCalledWith(grid)
    })

    it('should rollback placement on skill activation failure', () => {
      vi.mocked(hasSkill).mockReturnValue(true)
      skillManager.activateCharacterSkill = vi.fn().mockReturnValue(false)

      const result = executeAutoPlaceCharacter(grid, skillManager, 100, Team.ALLY)

      expect(result).toBe(false)

      // Check character was not placed on any tile
      const placedHex = [1, 2, 3].find((hexId) => grid.getTileById(hexId).characterId === 100)
      expect(placedHex).toBeUndefined()
    })

    it('should sort tiles deterministically before random selection', () => {
      // Run placement multiple times with same random seed
      const mathRandomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5)

      const results: number[] = []
      for (let i = 0; i < 5; i++) {
        // Reset grid
        grid = new Grid(TEST_GRID, TEST_ARENA)
        grid.skillManager = skillManager

        executeAutoPlaceCharacter(grid, skillManager, 100 + i, Team.ALLY)

        // Find where character was placed
        const placedHex = [1, 2, 3].find((hexId) => grid.getTileById(hexId).characterId === 100 + i)
        if (placedHex) results.push(placedHex)
      }

      // All placements should be on the same hex with fixed random
      expect(results.every((hex) => hex === results[0])).toBe(true)

      mathRandomSpy.mockRestore()
    })

    it('should handle undefined selected tile gracefully', () => {
      // Mock console.error
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      // Mock Math.random to return out of bounds index
      const mathRandomSpy = vi.spyOn(Math, 'random').mockReturnValue(1)

      const result = executeAutoPlaceCharacter(grid, skillManager, 100, Team.ALLY)

      expect(result).toBe(false)
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Selected tile is undefined'),
        expect.objectContaining({
          randomIndex: expect.any(Number),
          availableTilesLength: expect.any(Number),
        }),
      )

      consoleSpy.mockRestore()
      mathRandomSpy.mockRestore()
    })

    it('should place on enemy tiles for enemy team', () => {
      const result = executeAutoPlaceCharacter(grid, skillManager, 100, Team.ENEMY)

      expect(result).toBe(true)

      // Check character was placed on one of the enemy tiles (4 or 5)
      const placedHex = [4, 5].find((hexId) => grid.getTileById(hexId).characterId === 100)
      expect(placedHex).toBeDefined()
    })
  })

  describe('Edge cases', () => {
    it('should handle empty grid', () => {
      const emptyGrid = new Grid({ hex: [[]], qOffset: [0] }, { id: 1, name: 'Empty', grid: [] })
      emptyGrid.skillManager = skillManager

      const result = executeAutoPlaceCharacter(emptyGrid, skillManager, 100, Team.ALLY)
      expect(result).toBe(false)
    })

    it('should handle grid with no available tiles for team', () => {
      const enemyOnlyArena = {
        id: 1,
        name: 'Enemy Only',
        grid: [{ type: State.AVAILABLE_ENEMY, hex: [1, 2, 3, 4, 5, 6, 7] }],
      }
      const enemyGrid = new Grid(TEST_GRID, enemyOnlyArena)
      enemyGrid.skillManager = skillManager

      const result = executeAutoPlaceCharacter(enemyGrid, skillManager, 100, Team.ALLY)
      expect(result).toBe(false)
    })

    it('should handle concurrent placements correctly', () => {
      // Place multiple characters in sequence
      expect(performPlace(grid, 1, 100, Team.ALLY)).toBe(true)
      expect(performPlace(grid, 2, 200, Team.ALLY)).toBe(true)
      expect(performPlace(grid, 3, 300, Team.ALLY)).toBe(true)

      // Verify all are placed correctly
      expect(grid.getTileById(1).characterId).toBe(100)
      expect(grid.getTileById(2).characterId).toBe(200)
      expect(grid.getTileById(3).characterId).toBe(300)

      // Verify team tracking
      expect(grid.teamCharacters.get(Team.ALLY)?.size).toBe(3)
    })
  })
})

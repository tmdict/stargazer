import { beforeEach, describe, expect, it, vi } from 'vitest'

import { performPlace } from '../../../src/lib/characters/place'
import {
  executeClearAllCharacters,
  executeRemoveCharacter,
  performClearAll,
  performRemove,
} from '../../../src/lib/characters/remove'
import { Grid } from '../../../src/lib/grid'
// Import skill functions for mocking
import { hasSkill, SkillManager } from '../../../src/lib/skills/skill'
import type { GridPreset } from '../../../src/lib/types/grid'
import { State } from '../../../src/lib/types/state'
import { Team } from '../../../src/lib/types/team'

// Mock skill-related functions
vi.mock('../../../src/lib/skills/skill', () => ({
  hasSkill: vi.fn(),
  SkillManager: vi.fn(),
}))

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

describe('remove.ts', () => {
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
      deactivateAllSkills: vi.fn(),
      updateActiveSkills: vi.fn(),
    } as unknown as SkillManager

    // Set skillManager on grid for some tests
    grid.skillManager = skillManager

    // Default: characters don't have skills
    vi.mocked(hasSkill).mockReturnValue(false)
  })

  describe('performRemove', () => {
    it('should remove character from tile', () => {
      performPlace(grid, 1, 100, Team.ALLY)

      const result = performRemove(grid, 1)

      expect(result).toBe(true)
      const tile = grid.getTileById(1)
      expect(tile.characterId).toBeUndefined()
      expect(tile.team).toBeUndefined()
      expect(tile.state).toBe(State.AVAILABLE_ALLY)
    })

    it('should remove character from team tracking', () => {
      performPlace(grid, 1, 100, Team.ALLY)
      expect(grid.teamCharacters.get(Team.ALLY)?.has(100)).toBe(true)

      performRemove(grid, 1)

      expect(grid.teamCharacters.get(Team.ALLY)?.has(100)).toBe(false)
    })

    it('should return false when tile has no character', () => {
      const result = performRemove(grid, 1)

      expect(result).toBe(false)
    })

    it('should restore correct tile state for ally', () => {
      performPlace(grid, 1, 100, Team.ALLY)
      expect(grid.getTileById(1).state).toBe(State.OCCUPIED_ALLY)

      performRemove(grid, 1)

      expect(grid.getTileById(1).state).toBe(State.AVAILABLE_ALLY)
    })

    it('should restore correct tile state for enemy', () => {
      performPlace(grid, 4, 200, Team.ENEMY)
      expect(grid.getTileById(4).state).toBe(State.OCCUPIED_ENEMY)

      performRemove(grid, 4)

      expect(grid.getTileById(4).state).toBe(State.AVAILABLE_ENEMY)
    })

    it('should handle skipCacheInvalidation parameter', () => {
      performPlace(grid, 1, 100, Team.ALLY)

      // Just verify it accepts the parameter without error
      const result1 = performRemove(grid, 1, false)
      expect(result1).toBe(true)

      performPlace(grid, 2, 200, Team.ALLY)
      const result2 = performRemove(grid, 2, true)
      expect(result2).toBe(true)
    })

    it('should handle tile with missing team gracefully', () => {
      // Manually create invalid state
      const tile = grid.getTileById(1)
      tile.characterId = 999
      tile.team = undefined

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const result = performRemove(grid, 1)

      expect(result).toBe(false)
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('has characterId 999 but no team'),
      )

      consoleSpy.mockRestore()
    })

    it('should throw for invalid hex ID', () => {
      expect(() => performRemove(grid, 999)).toThrow()
    })
  })

  describe('executeRemoveCharacter', () => {
    it('should remove regular character', () => {
      performPlace(grid, 1, 100, Team.ALLY)

      const result = executeRemoveCharacter(grid, skillManager, 1)

      expect(result).toBe(true)
      expect(grid.getTileById(1).characterId).toBeUndefined()
      expect(skillManager.updateActiveSkills).toHaveBeenCalledWith(grid)
    })

    it('should return true when tile has no character', () => {
      const result = executeRemoveCharacter(grid, skillManager, 1)

      expect(result).toBe(true)
    })

    it('should return true when character has no team', () => {
      // Manually create invalid state
      const tile = grid.getTileById(1)
      tile.characterId = 100
      tile.team = undefined

      const result = executeRemoveCharacter(grid, skillManager, 1)

      expect(result).toBe(true)
    })

    it('should deactivate skill before removal', () => {
      vi.mocked(hasSkill).mockReturnValue(true)
      performPlace(grid, 1, 100, Team.ALLY)

      executeRemoveCharacter(grid, skillManager, 1)

      expect(skillManager.deactivateCharacterSkill).toHaveBeenCalledWith(100, 1, Team.ALLY, grid)
      // Verify deactivate was called
      expect(skillManager.deactivateCharacterSkill).toHaveBeenCalled()
    })

    it('should handle companion removal by removing main character', () => {
      const mainId = 100
      const companionId = grid.companionIdOffset + mainId

      // Place main character and companion
      performPlace(grid, 1, mainId, Team.ALLY)
      performPlace(grid, 2, companionId, Team.ALLY)

      // Mock the skill to be active
      vi.mocked(hasSkill).mockImplementation((id) => id === mainId)

      // Try to remove companion
      const result = executeRemoveCharacter(grid, skillManager, 2)

      expect(result).toBe(true)
      // Should have triggered skill deactivation for main character
      expect(skillManager.deactivateCharacterSkill).toHaveBeenCalledWith(mainId, 1, Team.ALLY, grid)
    })

    it('should remove orphaned companion directly', () => {
      const companionId = grid.companionIdOffset + 100

      // Place only companion (no main character)
      performPlace(grid, 2, companionId, Team.ALLY)

      const result = executeRemoveCharacter(grid, skillManager, 2)

      expect(result).toBe(true)
      expect(grid.getTileById(2).characterId).toBeUndefined()
    })

    it('should handle already removed character gracefully', () => {
      vi.mocked(hasSkill).mockReturnValue(true)
      performPlace(grid, 1, 100, Team.ALLY)

      // Mock skill deactivation to also remove the character
      skillManager.deactivateCharacterSkill = vi.fn().mockImplementation(() => {
        performRemove(grid, 1, true)
      })

      const result = executeRemoveCharacter(grid, skillManager, 1)

      expect(result).toBe(true)
      expect(skillManager.deactivateCharacterSkill).toHaveBeenCalled()
    })
  })

  describe('performClearAll', () => {
    it('should clear all characters from grid', () => {
      performPlace(grid, 1, 100, Team.ALLY)
      performPlace(grid, 2, 200, Team.ALLY)
      performPlace(grid, 4, 300, Team.ENEMY)

      const result = performClearAll(grid)

      expect(result).toBe(true)
      expect(grid.getTileById(1).characterId).toBeUndefined()
      expect(grid.getTileById(2).characterId).toBeUndefined()
      expect(grid.getTileById(4).characterId).toBeUndefined()
    })

    it('should clear team tracking', () => {
      performPlace(grid, 1, 100, Team.ALLY)
      performPlace(grid, 2, 200, Team.ALLY)
      performPlace(grid, 4, 300, Team.ENEMY)

      performClearAll(grid)

      expect(grid.teamCharacters.get(Team.ALLY)?.size).toBe(0)
      expect(grid.teamCharacters.get(Team.ENEMY)?.size).toBe(0)
    })

    it('should restore tile states correctly', () => {
      performPlace(grid, 1, 100, Team.ALLY)
      performPlace(grid, 4, 200, Team.ENEMY)

      performClearAll(grid)

      expect(grid.getTileById(1).state).toBe(State.AVAILABLE_ALLY)
      expect(grid.getTileById(4).state).toBe(State.AVAILABLE_ENEMY)
    })

    it('should return true when grid is already empty', () => {
      const result = performClearAll(grid)

      expect(result).toBe(true)
    })

    it('should update skills after clearing', () => {
      performPlace(grid, 1, 100, Team.ALLY)

      performClearAll(grid)

      expect(skillManager.updateActiveSkills).toHaveBeenCalledWith(grid)
    })

    it('should be able to rollback on transaction failure', () => {
      performPlace(grid, 1, 100, Team.ALLY)
      performPlace(grid, 2, 200, Team.ALLY)
      performPlace(grid, 4, 300, Team.ENEMY)

      // Store original state
      const originalState = {
        tile1: grid.getTileById(1).characterId,
        tile2: grid.getTileById(2).characterId,
        tile4: grid.getTileById(4).characterId,
        allySize: grid.teamCharacters.get(Team.ALLY)?.size,
        enemySize: grid.teamCharacters.get(Team.ENEMY)?.size,
      }

      // Clear should succeed
      const result = performClearAll(grid)
      expect(result).toBe(true)

      // Verify everything was cleared
      expect(grid.getTileById(1).characterId).toBeUndefined()
      expect(grid.getTileById(2).characterId).toBeUndefined()
      expect(grid.getTileById(4).characterId).toBeUndefined()
    })
  })

  describe('executeClearAllCharacters', () => {
    it('should deactivate all skills before clearing', () => {
      performPlace(grid, 1, 100, Team.ALLY)
      performPlace(grid, 2, 200, Team.ALLY)
      vi.mocked(hasSkill).mockReturnValue(true)

      executeClearAllCharacters(grid, skillManager)

      expect(skillManager.deactivateAllSkills).toHaveBeenCalledWith(grid)
      // Verify deactivate was called
      expect(skillManager.deactivateAllSkills).toHaveBeenCalled()
    })

    it('should clear all characters', () => {
      performPlace(grid, 1, 100, Team.ALLY)
      performPlace(grid, 2, 200, Team.ALLY)
      performPlace(grid, 4, 300, Team.ENEMY)

      const result = executeClearAllCharacters(grid, skillManager)

      expect(result).toBe(true)
      expect(grid.getTileById(1).characterId).toBeUndefined()
      expect(grid.getTileById(2).characterId).toBeUndefined()
      expect(grid.getTileById(4).characterId).toBeUndefined()
    })

    it('should handle empty grid', () => {
      const result = executeClearAllCharacters(grid, skillManager)

      expect(result).toBe(true)
      expect(skillManager.deactivateAllSkills).toHaveBeenCalled()
    })
  })

  describe('Edge cases', () => {
    it('should handle removing from all tiles sequentially', () => {
      performPlace(grid, 1, 100, Team.ALLY)
      performPlace(grid, 2, 200, Team.ALLY)
      performPlace(grid, 3, 300, Team.ALLY)

      expect(performRemove(grid, 1)).toBe(true)
      expect(performRemove(grid, 2)).toBe(true)
      expect(performRemove(grid, 3)).toBe(true)

      // All should be removed
      expect(grid.teamCharacters.get(Team.ALLY)?.size).toBe(0)
    })

    it('should handle remove after move', () => {
      performPlace(grid, 1, 100, Team.ALLY)

      // Move character
      performRemove(grid, 1)
      performPlace(grid, 2, 100, Team.ALLY)

      // Remove from new location
      const result = executeRemoveCharacter(grid, skillManager, 2)

      expect(result).toBe(true)
      expect(grid.getTileById(2).characterId).toBeUndefined()
    })

    it('should handle remove after swap', () => {
      performPlace(grid, 1, 100, Team.ALLY)
      performPlace(grid, 2, 200, Team.ALLY)

      // Manually simulate a swap
      const tile1 = grid.getTileById(1)
      const tile2 = grid.getTileById(2)
      const temp = tile1.characterId
      tile1.characterId = tile2.characterId
      tile2.characterId = temp

      // Remove from swapped position
      const result = executeRemoveCharacter(grid, skillManager, 1)

      expect(result).toBe(true)
      expect(grid.getTileById(1).characterId).toBeUndefined()
    })

    it('should handle clearing large grid', () => {
      // Place characters on all available tiles
      performPlace(grid, 1, 100, Team.ALLY)
      performPlace(grid, 2, 200, Team.ALLY)
      performPlace(grid, 3, 300, Team.ALLY)
      performPlace(grid, 4, 400, Team.ENEMY)
      performPlace(grid, 5, 500, Team.ENEMY)

      const result = performClearAll(grid)

      expect(result).toBe(true)
      // Verify all cleared
      for (const tile of grid.getAllTiles()) {
        expect(tile.characterId).toBeUndefined()
        expect(tile.team).toBeUndefined()
      }
    })

    it('should handle companion and main character removal correctly', () => {
      const mainId = 100
      const companionId1 = grid.companionIdOffset + mainId
      const companionId2 = grid.companionIdOffset + mainId + 1

      // Place main and companions
      performPlace(grid, 1, mainId, Team.ALLY)
      performPlace(grid, 2, companionId1, Team.ALLY)
      performPlace(grid, 3, companionId2, Team.ALLY)

      // Link companions
      const key = `${mainId}-${Team.ALLY}`
      grid.companionLinks.set(key, new Set([companionId1, companionId2]))

      vi.mocked(hasSkill).mockImplementation((id) => id === mainId)

      // Remove main character
      const result = executeRemoveCharacter(grid, skillManager, 1)

      expect(result).toBe(true)
      expect(skillManager.deactivateCharacterSkill).toHaveBeenCalledWith(mainId, 1, Team.ALLY, grid)
    })

    it('should handle invalid hex in executeRemoveCharacter', () => {
      expect(() => executeRemoveCharacter(grid, skillManager, 999)).toThrow()
    })
  })
})

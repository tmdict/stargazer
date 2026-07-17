import { beforeEach, describe, expect, it, vi } from 'vitest'

import { performPlace } from '@/lib/characters/place'
import {
  executeClearAllCharacters,
  executeRemoveCharacter,
  performClearAll,
  performRemove,
} from '@/lib/characters/remove'
import { Grid } from '@/lib/grid'
import { hasSkill, SkillManager } from '@/lib/skills/skill'
import { State } from '@/lib/types/state'
import { Team } from '@/lib/types/team'
import { STANDARD_ARENA, STANDARD_GRID } from '../fixtures/grid'

// Mock skill-related functions
vi.mock('@/lib/skills/skill', () => ({
  hasSkill: vi.fn(),
  SkillManager: vi.fn(),
}))

describe('remove.ts', () => {
  let grid: Grid
  let skillManager: SkillManager

  beforeEach(() => {
    grid = new Grid(STANDARD_GRID, STANDARD_ARENA)

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
    it('should remove the character, clearing team tracking and restoring tile state', () => {
      performPlace(grid, 1, 100, Team.ALLY)
      expect(grid.teamCharacters.get(Team.ALLY)?.has(100)).toBe(true)

      const result = performRemove(grid, 1)

      expect(result).toBe(true)
      const tile = grid.getTileById(1)
      expect(tile.characterId).toBeUndefined()
      expect(tile.team).toBeUndefined()
      expect(tile.state).toBe(State.AVAILABLE_ALLY)
      expect(grid.teamCharacters.get(Team.ALLY)?.has(100)).toBe(false)

      performPlace(grid, 4, 200, Team.ENEMY)
      expect(grid.getTileById(4).state).toBe(State.OCCUPIED_ENEMY)
      performRemove(grid, 4)
      expect(grid.getTileById(4).state).toBe(State.AVAILABLE_ENEMY)
    })

    it('should return false when tile has no character', () => {
      const result = performRemove(grid, 1)

      expect(result).toBe(false)
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

    it('should deactivate the skill on removal', () => {
      vi.mocked(hasSkill).mockReturnValue(true)
      performPlace(grid, 1, 100, Team.ALLY)

      executeRemoveCharacter(grid, skillManager, 1)

      expect(skillManager.deactivateCharacterSkill).toHaveBeenCalledWith(100, 1, Team.ALLY, grid)
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
        performRemove(grid, 1)
      })

      const result = executeRemoveCharacter(grid, skillManager, 1)

      expect(result).toBe(true)
      expect(skillManager.deactivateCharacterSkill).toHaveBeenCalled()
    })
  })

  describe('performClearAll', () => {
    it('should clear all characters, team tracking, and tile states, then update skills', () => {
      performPlace(grid, 1, 100, Team.ALLY)
      performPlace(grid, 2, 200, Team.ALLY)
      performPlace(grid, 4, 300, Team.ENEMY)

      const result = performClearAll(grid)

      expect(result).toBe(true)
      expect(grid.getTileById(1).characterId).toBeUndefined()
      expect(grid.getTileById(2).characterId).toBeUndefined()
      expect(grid.getTileById(4).characterId).toBeUndefined()
      expect(grid.teamCharacters.get(Team.ALLY)?.size).toBe(0)
      expect(grid.teamCharacters.get(Team.ENEMY)?.size).toBe(0)
      expect(grid.getTileById(1).state).toBe(State.AVAILABLE_ALLY)
      expect(grid.getTileById(4).state).toBe(State.AVAILABLE_ENEMY)
      expect(skillManager.updateActiveSkills).toHaveBeenCalledWith(grid)
    })

    it('should return true when grid is already empty', () => {
      const result = performClearAll(grid)

      expect(result).toBe(true)
    })
  })

  describe('executeClearAllCharacters', () => {
    it('should deactivate all skills on clear', () => {
      performPlace(grid, 1, 100, Team.ALLY)
      performPlace(grid, 2, 200, Team.ALLY)

      executeClearAllCharacters(grid, skillManager)

      expect(skillManager.deactivateAllSkills).toHaveBeenCalledWith(grid)
    })

    it('should handle empty grid', () => {
      const result = executeClearAllCharacters(grid, skillManager)

      expect(result).toBe(true)
      expect(skillManager.deactivateAllSkills).toHaveBeenCalled()
    })
  })

  describe('Edge cases', () => {
    it('should handle invalid hex in executeRemoveCharacter', () => {
      expect(() => executeRemoveCharacter(grid, skillManager, 999)).toThrow()
    })
  })
})

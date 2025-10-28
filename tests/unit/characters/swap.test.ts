import { beforeEach, describe, expect, it, vi } from 'vitest'

import { performPlace } from '@/lib/characters/place'
import { executeSwapCharacters } from '@/lib/characters/swap'
import { Grid } from '@/lib/grid'
// Import skill functions for mocking
import { hasCompanionSkill, hasSkill, SkillManager } from '@/lib/skills/skill'
import type { GridPreset } from '@/lib/types/grid'
import { State } from '@/lib/types/state'
import { Team } from '@/lib/types/team'

// Mock skill-related functions
vi.mock('@/lib/skills/skill', () => ({
  hasSkill: vi.fn(),
  hasCompanionSkill: vi.fn(),
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

describe('swap.ts', () => {
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
      addCharacterColorModifier: vi.fn(),
      hasActiveSkill: vi.fn().mockReturnValue(false),
    } as unknown as SkillManager

    // Set skillManager on grid for some tests
    grid.skillManager = skillManager

    // Default: characters don't have skills
    vi.mocked(hasSkill).mockReturnValue(false)
    vi.mocked(hasCompanionSkill).mockReturnValue(false)
  })

  describe('executeSwapCharacters - basic validation', () => {
    it('should reject swap on same hex', () => {
      performPlace(grid, 1, 100, Team.ALLY)

      const result = executeSwapCharacters(grid, skillManager, 1, 1)

      expect(result).toBe(false)
      expect(grid.getTileById(1).characterId).toBe(100)
    })

    it('should reject swap when fromHex has no character', () => {
      performPlace(grid, 2, 200, Team.ALLY)

      const result = executeSwapCharacters(grid, skillManager, 1, 2)

      expect(result).toBe(false)
      expect(grid.getTileById(2).characterId).toBe(200)
    })

    it('should reject swap when toHex has no character', () => {
      performPlace(grid, 1, 100, Team.ALLY)

      const result = executeSwapCharacters(grid, skillManager, 1, 2)

      expect(result).toBe(false)
      expect(grid.getTileById(1).characterId).toBe(100)
    })

    it('should reject swap when either character has no team', () => {
      // Manually create invalid state
      const tile1 = grid.getTileById(1)
      tile1.characterId = 100
      tile1.team = undefined
      tile1.state = State.OCCUPIED_ALLY

      performPlace(grid, 2, 200, Team.ALLY)

      const result = executeSwapCharacters(grid, skillManager, 1, 2)

      expect(result).toBe(false)
    })
  })

  describe('executeSwapCharacters - same team swaps', () => {
    it('should swap two ally characters', () => {
      performPlace(grid, 1, 100, Team.ALLY)
      performPlace(grid, 2, 200, Team.ALLY)

      const result = executeSwapCharacters(grid, skillManager, 1, 2)

      expect(result).toBe(true)
      expect(grid.getTileById(1).characterId).toBe(200)
      expect(grid.getTileById(2).characterId).toBe(100)
      expect(grid.getTileById(1).team).toBe(Team.ALLY)
      expect(grid.getTileById(2).team).toBe(Team.ALLY)
    })

    it('should swap two enemy characters', () => {
      performPlace(grid, 4, 300, Team.ENEMY)
      performPlace(grid, 5, 400, Team.ENEMY)

      const result = executeSwapCharacters(grid, skillManager, 4, 5)

      expect(result).toBe(true)
      expect(grid.getTileById(4).characterId).toBe(400)
      expect(grid.getTileById(5).characterId).toBe(300)
      expect(grid.getTileById(4).team).toBe(Team.ENEMY)
      expect(grid.getTileById(5).team).toBe(Team.ENEMY)
    })

    it('should maintain team membership after swap', () => {
      performPlace(grid, 1, 100, Team.ALLY)
      performPlace(grid, 2, 200, Team.ALLY)

      executeSwapCharacters(grid, skillManager, 1, 2)

      expect(grid.teamCharacters.get(Team.ALLY)?.has(100)).toBe(true)
      expect(grid.teamCharacters.get(Team.ALLY)?.has(200)).toBe(true)
      expect(grid.teamCharacters.get(Team.ALLY)?.size).toBe(2)
    })

    it('should update skill manager after successful swap', () => {
      performPlace(grid, 1, 100, Team.ALLY)
      performPlace(grid, 2, 200, Team.ALLY)

      executeSwapCharacters(grid, skillManager, 1, 2)

      expect(skillManager.updateActiveSkills).toHaveBeenCalledWith(grid)
    })
  })

  describe('executeSwapCharacters - cross-team swaps without skills', () => {
    it('should swap ally and enemy characters', () => {
      performPlace(grid, 1, 100, Team.ALLY)
      performPlace(grid, 4, 200, Team.ENEMY)

      const result = executeSwapCharacters(grid, skillManager, 1, 4)

      expect(result).toBe(true)
      expect(grid.getTileById(1).characterId).toBe(200)
      expect(grid.getTileById(4).characterId).toBe(100)
      expect(grid.getTileById(1).team).toBe(Team.ALLY)
      expect(grid.getTileById(4).team).toBe(Team.ENEMY)
    })

    it('should update team memberships correctly', () => {
      performPlace(grid, 1, 100, Team.ALLY)
      performPlace(grid, 4, 200, Team.ENEMY)

      executeSwapCharacters(grid, skillManager, 1, 4)

      expect(grid.teamCharacters.get(Team.ALLY)?.has(200)).toBe(true)
      expect(grid.teamCharacters.get(Team.ALLY)?.has(100)).toBe(false)
      expect(grid.teamCharacters.get(Team.ENEMY)?.has(100)).toBe(true)
      expect(grid.teamCharacters.get(Team.ENEMY)?.has(200)).toBe(false)
    })

    it('should maintain tile states after cross-team swap', () => {
      performPlace(grid, 1, 100, Team.ALLY)
      performPlace(grid, 4, 200, Team.ENEMY)

      executeSwapCharacters(grid, skillManager, 1, 4)

      // Tiles should maintain their occupied states
      expect(grid.getTileById(1).state).toBe(State.OCCUPIED_ALLY)
      expect(grid.getTileById(4).state).toBe(State.OCCUPIED_ENEMY)
    })
  })

  describe('executeSwapCharacters - cross-team swaps with skills', () => {
    it('should handle swap when fromChar has skill', () => {
      vi.mocked(hasSkill).mockImplementation((charId) => charId === 100)
      skillManager.hasActiveSkill = vi.fn().mockImplementation((charId) => charId === 100)

      performPlace(grid, 1, 100, Team.ALLY)
      performPlace(grid, 4, 200, Team.ENEMY)

      const result = executeSwapCharacters(grid, skillManager, 1, 4)

      expect(result).toBe(true)
      expect(skillManager.deactivateCharacterSkill).toHaveBeenCalledWith(100, 1, Team.ALLY, grid)
      expect(skillManager.activateCharacterSkill).toHaveBeenCalledWith(100, 4, Team.ENEMY, grid)
    })

    it('should handle swap when toChar has skill', () => {
      vi.mocked(hasSkill).mockImplementation((charId) => charId === 200)
      skillManager.hasActiveSkill = vi.fn().mockImplementation((charId) => charId === 200)

      performPlace(grid, 1, 100, Team.ALLY)
      performPlace(grid, 4, 200, Team.ENEMY)

      const result = executeSwapCharacters(grid, skillManager, 1, 4)

      expect(result).toBe(true)
      expect(skillManager.deactivateCharacterSkill).toHaveBeenCalledWith(200, 4, Team.ENEMY, grid)
      expect(skillManager.activateCharacterSkill).toHaveBeenCalledWith(200, 1, Team.ALLY, grid)
    })

    it('should handle swap when both characters have skills', () => {
      vi.mocked(hasSkill).mockReturnValue(true)
      skillManager.hasActiveSkill = vi.fn().mockReturnValue(true)

      performPlace(grid, 1, 100, Team.ALLY)
      performPlace(grid, 4, 200, Team.ENEMY)

      const result = executeSwapCharacters(grid, skillManager, 1, 4)

      expect(result).toBe(true)
      // Both skills should be deactivated
      expect(skillManager.deactivateCharacterSkill).toHaveBeenCalledTimes(2)
      // Both skills should be activated at new positions
      expect(skillManager.activateCharacterSkill).toHaveBeenCalledTimes(2)
    })

    it('should rollback on skill activation failure', () => {
      vi.mocked(hasSkill).mockReturnValue(true)
      skillManager.hasActiveSkill = vi.fn().mockReturnValue(true)
      skillManager.activateCharacterSkill = vi.fn().mockReturnValue(false)

      performPlace(grid, 1, 100, Team.ALLY)
      performPlace(grid, 4, 200, Team.ENEMY)

      const result = executeSwapCharacters(grid, skillManager, 1, 4)

      expect(result).toBe(false)
      // After fix: Characters should remain at original positions after rollback
      expect(grid.getTileById(1).characterId).toBe(100)
      expect(grid.getTileById(4).characterId).toBe(200)
      expect(grid.getTileById(1).team).toBe(Team.ALLY)
      expect(grid.getTileById(4).team).toBe(Team.ENEMY)
    })

    it('should handle companion skill restoration on rollback', () => {
      vi.mocked(hasSkill).mockReturnValue(true)
      vi.mocked(hasCompanionSkill).mockReturnValue(true)
      skillManager.hasActiveSkill = vi.fn().mockReturnValue(true)
      skillManager.activateCharacterSkill = vi
        .fn()
        .mockReturnValueOnce(false) // Fail first activation
        .mockReturnValue(true) // Succeed on rollback

      const mainId = 100
      const companionId = grid.companionIdOffset + mainId

      performPlace(grid, 1, mainId, Team.ALLY)
      performPlace(grid, 2, companionId, Team.ALLY)
      performPlace(grid, 4, 200, Team.ENEMY)

      // Link companion to main character
      const key = `${mainId}-${Team.ALLY}`
      grid.companionLinks.set(key, new Set([companionId]))

      const result = executeSwapCharacters(grid, skillManager, 1, 4)

      expect(result).toBe(false)
      expect(hasCompanionSkill).toHaveBeenCalled()
    })
  })

  describe('executeSwapCharacters - companion handling', () => {
    it('should prevent companion swap across teams', () => {
      const companionId = grid.companionIdOffset + 1
      performPlace(grid, 1, companionId, Team.ALLY)
      performPlace(grid, 4, 200, Team.ENEMY)

      const result = executeSwapCharacters(grid, skillManager, 1, 4)

      expect(result).toBe(false)
      expect(grid.getTileById(1).characterId).toBe(companionId)
      expect(grid.getTileById(4).characterId).toBe(200)
    })

    it('should prevent swap with companion across teams', () => {
      const companionId = grid.companionIdOffset + 1
      performPlace(grid, 1, 100, Team.ALLY)
      performPlace(grid, 4, companionId, Team.ENEMY)

      const result = executeSwapCharacters(grid, skillManager, 1, 4)

      expect(result).toBe(false)
      expect(grid.getTileById(1).characterId).toBe(100)
      expect(grid.getTileById(4).characterId).toBe(companionId)
    })

    it('should allow companion swap within same team', () => {
      const companionId = grid.companionIdOffset + 1
      performPlace(grid, 1, companionId, Team.ALLY)
      performPlace(grid, 2, 200, Team.ALLY)

      const result = executeSwapCharacters(grid, skillManager, 1, 2)

      expect(result).toBe(true)
      expect(grid.getTileById(1).characterId).toBe(200)
      expect(grid.getTileById(2).characterId).toBe(companionId)
    })
  })

  describe('Edge cases', () => {
    it('should handle empty grid', () => {
      const emptyGrid = new Grid({ hex: [[]], qOffset: [0] }, { id: 1, name: 'Empty', grid: [] })
      emptyGrid.skillManager = skillManager

      // This will throw because hex doesn't exist
      expect(() => executeSwapCharacters(emptyGrid, skillManager, 1, 2)).toThrow()
    })

    it('should handle invalid hex IDs', () => {
      performPlace(grid, 1, 100, Team.ALLY)
      performPlace(grid, 2, 200, Team.ALLY)

      expect(() => executeSwapCharacters(grid, skillManager, 1, 999)).toThrow()
      expect(() => executeSwapCharacters(grid, skillManager, 999, 2)).toThrow()
    })

    it('should handle sequential swaps correctly', () => {
      performPlace(grid, 1, 100, Team.ALLY)
      performPlace(grid, 2, 200, Team.ALLY)
      performPlace(grid, 3, 300, Team.ALLY)

      // Swap 1 and 2
      expect(executeSwapCharacters(grid, skillManager, 1, 2)).toBe(true)
      expect(grid.getTileById(1).characterId).toBe(200)
      expect(grid.getTileById(2).characterId).toBe(100)

      // Now swap 2 and 3
      expect(executeSwapCharacters(grid, skillManager, 2, 3)).toBe(true)
      expect(grid.getTileById(2).characterId).toBe(300)
      expect(grid.getTileById(3).characterId).toBe(100)

      // Final state: 1->200, 2->300, 3->100
      expect(grid.getTileById(1).characterId).toBe(200)
      expect(grid.getTileById(2).characterId).toBe(300)
      expect(grid.getTileById(3).characterId).toBe(100)
    })

    it('should maintain grid consistency after multiple cross-team swaps', () => {
      performPlace(grid, 1, 100, Team.ALLY)
      performPlace(grid, 2, 200, Team.ALLY)
      performPlace(grid, 4, 300, Team.ENEMY)
      performPlace(grid, 5, 400, Team.ENEMY)

      // Swap ally with enemy
      executeSwapCharacters(grid, skillManager, 1, 4)
      // Swap other ally with other enemy
      executeSwapCharacters(grid, skillManager, 2, 5)

      // Verify team sizes
      expect(grid.teamCharacters.get(Team.ALLY)?.size).toBe(2)
      expect(grid.teamCharacters.get(Team.ENEMY)?.size).toBe(2)

      // Verify correct team memberships after cross-team swaps
      // 100 (ally) swapped with 300 (enemy): 100 is now on ENEMY team, 300 is now on ALLY team
      // 200 (ally) swapped with 400 (enemy): 200 is now on ENEMY team, 400 is now on ALLY team
      expect(grid.teamCharacters.get(Team.ENEMY)?.has(100)).toBe(true)
      expect(grid.teamCharacters.get(Team.ENEMY)?.has(200)).toBe(true)
      expect(grid.teamCharacters.get(Team.ALLY)?.has(300)).toBe(true)
      expect(grid.teamCharacters.get(Team.ALLY)?.has(400)).toBe(true)
    })
  })
})

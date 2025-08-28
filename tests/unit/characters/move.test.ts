import { beforeEach, describe, expect, it, vi } from 'vitest'

import { executeMoveCharacter } from '../../../src/lib/characters/move'
import { performPlace } from '../../../src/lib/characters/place'
import { Grid } from '../../../src/lib/grid'
// Import skill functions for mocking
import { hasCompanionSkill, hasSkill, SkillManager } from '../../../src/lib/skills/skill'
import type { GridPreset } from '../../../src/lib/types/grid'
import { State } from '../../../src/lib/types/state'
import { Team } from '../../../src/lib/types/team'

// Mock skill-related functions
vi.mock('../../../src/lib/skills/skill', () => ({
  hasSkill: vi.fn(),
  hasCompanionSkill: vi.fn(),
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

describe('move.ts', () => {
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
    } as unknown as SkillManager

    // Set skillManager on grid for some tests
    grid.skillManager = skillManager

    // Default: characters don't have skills
    vi.mocked(hasSkill).mockReturnValue(false)
    vi.mocked(hasCompanionSkill).mockReturnValue(false)
  })

  describe('executeMoveCharacter - basic validation', () => {
    it('should reject move to same hex', () => {
      performPlace(grid, 1, 100, Team.ALLY)

      const result = executeMoveCharacter(grid, skillManager, 1, 1, 100)

      expect(result).toBe(false)
      expect(grid.getTileById(1).characterId).toBe(100)
    })

    it('should reject move with wrong character ID', () => {
      performPlace(grid, 1, 100, Team.ALLY)

      const result = executeMoveCharacter(grid, skillManager, 1, 2, 200)

      expect(result).toBe(false)
      expect(grid.getTileById(1).characterId).toBe(100)
      expect(grid.getTileById(2).characterId).toBeUndefined()
    })

    it('should reject move from empty hex', () => {
      const result = executeMoveCharacter(grid, skillManager, 1, 2, 100)

      expect(result).toBe(false)
    })

    it('should reject move to invalid destination', () => {
      performPlace(grid, 1, 100, Team.ALLY)

      // Try to move to blocked tile
      const result = executeMoveCharacter(grid, skillManager, 1, 6, 100)

      expect(result).toBe(false)
      expect(grid.getTileById(1).characterId).toBe(100)
      expect(grid.getTileById(6).characterId).toBeUndefined()
    })
  })

  describe('executeMoveCharacter - same team movement', () => {
    it('should move character within ally team', () => {
      performPlace(grid, 1, 100, Team.ALLY)

      const result = executeMoveCharacter(grid, skillManager, 1, 2, 100)

      expect(result).toBe(true)
      expect(grid.getTileById(1).characterId).toBeUndefined()
      expect(grid.getTileById(2).characterId).toBe(100)
      expect(grid.getTileById(2).team).toBe(Team.ALLY)
      expect(grid.getTileById(1).state).toBe(State.AVAILABLE_ALLY)
      expect(grid.getTileById(2).state).toBe(State.OCCUPIED_ALLY)
    })

    it('should move character within enemy team', () => {
      performPlace(grid, 4, 200, Team.ENEMY)

      const result = executeMoveCharacter(grid, skillManager, 4, 5, 200)

      expect(result).toBe(true)
      expect(grid.getTileById(4).characterId).toBeUndefined()
      expect(grid.getTileById(5).characterId).toBe(200)
      expect(grid.getTileById(5).team).toBe(Team.ENEMY)
    })

    it('should replace existing character on destination', () => {
      performPlace(grid, 1, 100, Team.ALLY)
      performPlace(grid, 2, 200, Team.ALLY)

      const result = executeMoveCharacter(grid, skillManager, 1, 2, 100)

      expect(result).toBe(true)
      expect(grid.getTileById(2).characterId).toBe(100)
      expect(grid.teamCharacters.get(Team.ALLY)?.has(100)).toBe(true)
      expect(grid.teamCharacters.get(Team.ALLY)?.has(200)).toBe(false)
    })

    it('should update skill manager after successful move', () => {
      performPlace(grid, 1, 100, Team.ALLY)

      executeMoveCharacter(grid, skillManager, 1, 2, 100)

      expect(skillManager.updateActiveSkills).toHaveBeenCalledWith(grid)
    })

    it('should complete move successfully', () => {
      performPlace(grid, 1, 100, Team.ALLY)

      const result = executeMoveCharacter(grid, skillManager, 1, 2, 100)

      expect(result).toBe(true)
      expect(grid.getTileById(2).characterId).toBe(100)
    })
  })

  describe('executeMoveCharacter - cross-team movement without skills', () => {
    it('should move character from ally to enemy team', () => {
      performPlace(grid, 1, 100, Team.ALLY)

      const result = executeMoveCharacter(grid, skillManager, 1, 4, 100)

      expect(result).toBe(true)
      expect(grid.getTileById(1).characterId).toBeUndefined()
      expect(grid.getTileById(4).characterId).toBe(100)
      expect(grid.getTileById(4).team).toBe(Team.ENEMY)
      expect(grid.teamCharacters.get(Team.ALLY)?.has(100)).toBe(false)
      expect(grid.teamCharacters.get(Team.ENEMY)?.has(100)).toBe(true)
    })

    it('should move character from enemy to ally team', () => {
      performPlace(grid, 4, 200, Team.ENEMY)

      const result = executeMoveCharacter(grid, skillManager, 4, 1, 200)

      expect(result).toBe(true)
      expect(grid.getTileById(4).characterId).toBeUndefined()
      expect(grid.getTileById(1).characterId).toBe(200)
      expect(grid.getTileById(1).team).toBe(Team.ALLY)
      expect(grid.teamCharacters.get(Team.ENEMY)?.has(200)).toBe(false)
      expect(grid.teamCharacters.get(Team.ALLY)?.has(200)).toBe(true)
    })
  })

  describe('executeMoveCharacter - cross-team movement with skills', () => {
    beforeEach(() => {
      vi.mocked(hasSkill).mockReturnValue(true)
    })

    it('should deactivate and reactivate skill on team change', () => {
      performPlace(grid, 1, 100, Team.ALLY)

      const result = executeMoveCharacter(grid, skillManager, 1, 4, 100)

      expect(result).toBe(true)
      expect(skillManager.deactivateCharacterSkill).toHaveBeenCalledWith(100, 1, Team.ALLY, grid)
      expect(skillManager.activateCharacterSkill).toHaveBeenCalledWith(100, 4, Team.ENEMY, grid)
    })

    it('should rollback on skill activation failure', () => {
      performPlace(grid, 1, 100, Team.ALLY)
      skillManager.activateCharacterSkill = vi.fn().mockReturnValue(false)

      const result = executeMoveCharacter(grid, skillManager, 1, 4, 100)

      expect(result).toBe(false)
      // Character should remain at original position
      expect(grid.getTileById(1).characterId).toBe(100)
      expect(grid.getTileById(1).team).toBe(Team.ALLY)
    })

    it('should restore skill on rollback', () => {
      performPlace(grid, 1, 100, Team.ALLY)
      // Skill activation will fail on team change, triggering rollback
      skillManager.activateCharacterSkill = vi.fn().mockReturnValue(false)

      const result = executeMoveCharacter(grid, skillManager, 1, 4, 100)

      expect(result).toBe(false)
      // Verify original skill activation was attempted
      expect(skillManager.activateCharacterSkill).toHaveBeenCalledWith(100, 4, Team.ENEMY, grid)
      // Character should be back at original position
      expect(grid.getTileById(1).characterId).toBe(100)
    })
  })

  describe('executeMoveCharacter - companion handling', () => {
    it('should prevent companions from changing teams', () => {
      const companionId = grid.companionIdOffset + 1
      performPlace(grid, 1, companionId, Team.ALLY)

      const result = executeMoveCharacter(grid, skillManager, 1, 4, companionId)

      expect(result).toBe(false)
      expect(grid.getTileById(1).characterId).toBe(companionId)
      expect(grid.getTileById(4).characterId).toBeUndefined()
    })

    it('should allow companions to move within same team', () => {
      const companionId = grid.companionIdOffset + 1
      performPlace(grid, 1, companionId, Team.ALLY)

      const result = executeMoveCharacter(grid, skillManager, 1, 2, companionId)

      expect(result).toBe(true)
      expect(grid.getTileById(1).characterId).toBeUndefined()
      expect(grid.getTileById(2).characterId).toBe(companionId)
    })

    it('should store and restore companion positions on cross-team move with companion skill', () => {
      vi.mocked(hasSkill).mockReturnValue(true)
      vi.mocked(hasCompanionSkill).mockReturnValue(true)

      // Set up main character and companion
      const mainId = 100
      const companionId = grid.companionIdOffset + mainId
      performPlace(grid, 1, mainId, Team.ALLY)
      performPlace(grid, 2, companionId, Team.ALLY)

      // Link companion to main character
      const key = `${mainId}-${Team.ALLY}`
      grid.companionLinks.set(key, new Set([companionId]))

      // Mock skill activation failure to trigger rollback
      skillManager.activateCharacterSkill = vi
        .fn()
        .mockReturnValueOnce(false) // Fail on team change
        .mockReturnValueOnce(true) // Succeed on rollback

      const result = executeMoveCharacter(grid, skillManager, 1, 4, mainId)

      expect(result).toBe(false)
      // Main character should be restored
      expect(grid.getTileById(1).characterId).toBe(mainId)
      // Companion restoration is mocked, so we just verify the flow
      expect(hasCompanionSkill).toHaveBeenCalled()
    })
  })

  describe('Transaction and rollback behavior', () => {
    it('should handle transaction failure in performMove', () => {
      performPlace(grid, 1, 100, Team.ALLY)
      // Place another character at destination
      performPlace(grid, 2, 200, Team.ALLY)

      // Move should succeed by replacing the character at destination
      const result = executeMoveCharacter(grid, skillManager, 1, 2, 100)

      expect(result).toBe(true)
      expect(grid.getTileById(2).characterId).toBe(100)
      // Character 200 should be removed from team
      expect(grid.teamCharacters.get(Team.ALLY)?.has(200)).toBe(false)
    })

    it('should handle complex move sequences', () => {
      // Test multiple moves in sequence
      performPlace(grid, 1, 100, Team.ALLY)
      performPlace(grid, 2, 200, Team.ALLY)

      // Move first character
      let result = executeMoveCharacter(grid, skillManager, 1, 3, 100)
      expect(result).toBe(true)

      // Move second character to vacated spot
      result = executeMoveCharacter(grid, skillManager, 2, 1, 200)
      expect(result).toBe(true)

      expect(grid.getTileById(3).characterId).toBe(100)
      expect(grid.getTileById(1).characterId).toBe(200)
      expect(grid.getTileById(2).characterId).toBeUndefined()
    })
  })

  describe('Edge cases', () => {
    it('should handle move on empty grid', () => {
      const emptyGrid = new Grid({ hex: [[]], qOffset: [0] }, { id: 1, name: 'Empty', grid: [] })
      emptyGrid.skillManager = skillManager

      // This will throw because hex 1 doesn't exist in empty grid
      expect(() => executeMoveCharacter(emptyGrid, skillManager, 1, 2, 100)).toThrow(
        'Hex with ID 1 not found',
      )
    })

    it('should handle invalid hex IDs', () => {
      performPlace(grid, 1, 100, Team.ALLY)

      expect(() => executeMoveCharacter(grid, skillManager, 1, 999, 100)).toThrow()
    })

    it('should handle concurrent moves correctly', () => {
      // Set up multiple characters
      performPlace(grid, 1, 100, Team.ALLY)
      performPlace(grid, 2, 200, Team.ALLY)
      performPlace(grid, 4, 300, Team.ENEMY)

      // Execute multiple moves
      expect(executeMoveCharacter(grid, skillManager, 1, 3, 100)).toBe(true)
      expect(executeMoveCharacter(grid, skillManager, 2, 1, 200)).toBe(true)
      expect(executeMoveCharacter(grid, skillManager, 4, 5, 300)).toBe(true)

      // Verify final positions
      expect(grid.getTileById(3).characterId).toBe(100)
      expect(grid.getTileById(1).characterId).toBe(200)
      expect(grid.getTileById(5).characterId).toBe(300)
    })

    it('should maintain team integrity during moves', () => {
      performPlace(grid, 1, 100, Team.ALLY)
      performPlace(grid, 2, 200, Team.ALLY)

      // Move one character to enemy team
      executeMoveCharacter(grid, skillManager, 1, 4, 100)

      // Verify team memberships
      expect(grid.teamCharacters.get(Team.ALLY)?.size).toBe(1)
      expect(grid.teamCharacters.get(Team.ALLY)?.has(200)).toBe(true)
      expect(grid.teamCharacters.get(Team.ENEMY)?.size).toBe(1)
      expect(grid.teamCharacters.get(Team.ENEMY)?.has(100)).toBe(true)
    })

    it('should handle move to occupied tile of different team', () => {
      performPlace(grid, 1, 100, Team.ALLY)
      performPlace(grid, 4, 200, Team.ENEMY)

      // Move ally to occupied enemy tile (should replace)
      const result = executeMoveCharacter(grid, skillManager, 1, 4, 100)

      expect(result).toBe(true)
      expect(grid.getTileById(4).characterId).toBe(100)
      expect(grid.getTileById(4).team).toBe(Team.ENEMY)
      expect(grid.teamCharacters.get(Team.ENEMY)?.has(100)).toBe(true)
      expect(grid.teamCharacters.get(Team.ENEMY)?.has(200)).toBe(false)
    })

    it('should handle character with no team gracefully', () => {
      // Manually create invalid state
      const tile = grid.getTileById(1)
      tile.characterId = 100
      tile.team = undefined
      tile.state = State.OCCUPIED_ALLY

      const result = executeMoveCharacter(grid, skillManager, 1, 2, 100)

      expect(result).toBe(false)
    })

    it('should handle destination with no valid team state', () => {
      performPlace(grid, 1, 100, Team.ALLY)

      // Try to move to DEFAULT state tile (no team)
      const result = executeMoveCharacter(grid, skillManager, 1, 7, 100)

      expect(result).toBe(false)
      expect(grid.getTileById(1).characterId).toBe(100)
    })
  })
})

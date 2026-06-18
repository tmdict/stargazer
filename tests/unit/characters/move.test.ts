import { beforeEach, describe, expect, it, vi } from 'vitest'

import { addCompanionLink } from '@/lib/characters/companion'
import { executeMoveCharacter } from '@/lib/characters/move'
import { performPlace } from '@/lib/characters/place'
import { performRemove } from '@/lib/characters/remove'
import { Grid } from '@/lib/grid'
// Import skill functions for mocking
import { getCharacterSkill, hasCompanionSkill, hasSkill, SkillManager } from '@/lib/skills/skill'
import { State } from '@/lib/types/state'
import { Team } from '@/lib/types/team'
import { STANDARD_ARENA, STANDARD_GRID } from '../fixtures/grid'

// Mock skill-related functions
vi.mock('@/lib/skills/skill', () => ({
  hasSkill: vi.fn(),
  hasCompanionSkill: vi.fn(),
  getCharacterSkill: vi.fn(),
  SkillManager: vi.fn(),
}))

// Don't mock performRemove globally - import the real implementation

describe('move.ts', () => {
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

    it('should reject move onto an occupied destination', () => {
      performPlace(grid, 1, 100, Team.ALLY)
      performPlace(grid, 2, 200, Team.ALLY)

      // Occupied destinations are swap territory; a move never displaces a unit
      const result = executeMoveCharacter(grid, skillManager, 1, 2, 100)

      expect(result).toBe(false)
      expect(grid.getTileById(1).characterId).toBe(100)
      expect(grid.getTileById(2).characterId).toBe(200)
      expect(grid.teamCharacters.get(Team.ALLY)?.has(100)).toBe(true)
      expect(grid.teamCharacters.get(Team.ALLY)?.has(200)).toBe(true)
    })

    it('should update skill manager after successful move', () => {
      performPlace(grid, 1, 100, Team.ALLY)

      executeMoveCharacter(grid, skillManager, 1, 2, 100)

      expect(skillManager.updateActiveSkills).toHaveBeenCalledWith(grid)
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
      // The destination must be fully vacated — no duplicate left behind
      expect(grid.getTileById(4).characterId).toBeUndefined()
      expect(grid.getTileById(4).state).toBe(State.AVAILABLE_ENEMY)
      // Team membership restored: on the original team only
      expect(grid.teamCharacters.get(Team.ALLY)?.has(100)).toBe(true)
      expect(grid.teamCharacters.get(Team.ENEMY)?.has(100)).toBe(false)
    })

    it('should reactivate the skill at the origin on rollback', () => {
      performPlace(grid, 1, 100, Team.ALLY)
      skillManager.activateCharacterSkill = vi.fn().mockReturnValue(false)

      const result = executeMoveCharacter(grid, skillManager, 1, 4, 100)

      expect(result).toBe(false)
      // Failed activation at the destination, then reactivation at the origin
      expect(skillManager.activateCharacterSkill).toHaveBeenCalledWith(100, 4, Team.ENEMY, grid)
      expect(skillManager.activateCharacterSkill).toHaveBeenCalledWith(100, 1, Team.ALLY, grid)
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

    it('should restore a displaced companion to its stored hex on rollback', () => {
      vi.mocked(hasSkill).mockReturnValue(true)
      vi.mocked(hasCompanionSkill).mockReturnValue(true)

      const mainId = 100
      const companionId = grid.companionIdOffset + mainId
      performPlace(grid, 1, mainId, Team.ALLY)
      performPlace(grid, 2, companionId, Team.ALLY)
      addCompanionLink(grid, mainId, companionId, Team.ALLY)

      // Restoration re-applies the main skill's companion color modifier
      vi.mocked(getCharacterSkill).mockReturnValue({
        id: 'companion-test',
        characterId: mainId,
        companionColorModifier: 'rgba(10, 20, 30, 0.4)',
        onActivate: () => {},
        onDeactivate: () => {},
      })

      // Mirror the real skill lifecycle: deactivation removes the companion;
      // activation fails at the destination (triggering rollback) and on the
      // rollback reactivation re-spawns the companion at its default hex (3),
      // from which restoreCompanions must return it to the stored hex (2)
      skillManager.deactivateCharacterSkill = vi.fn().mockImplementation(() => {
        performRemove(grid, 2)
      })
      skillManager.activateCharacterSkill = vi
        .fn()
        .mockImplementation((id: number, hexId: number) => {
          if (hexId === 4) return false
          performPlace(grid, 3, companionId, Team.ALLY)
          return true
        })

      const result = executeMoveCharacter(grid, skillManager, 1, 4, mainId)

      expect(result).toBe(false)
      expect(grid.getTileById(1).characterId).toBe(mainId)
      expect(grid.getTileById(2).characterId).toBe(companionId)
      expect(grid.getTileById(3).characterId).toBeUndefined()
      expect(skillManager.addCharacterColorModifier).toHaveBeenCalledWith(
        companionId,
        Team.ALLY,
        'rgba(10, 20, 30, 0.4)',
      )
    })
  })

  describe('Edge cases', () => {
    it('should handle move on empty grid', () => {
      const emptyGrid = new Grid({ hex: [[]], qOffset: [0] }, { name: 'Empty', grid: [] })
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

    it('should handle sequential moves correctly', () => {
      performPlace(grid, 1, 100, Team.ALLY)
      performPlace(grid, 2, 200, Team.ALLY)
      performPlace(grid, 4, 300, Team.ENEMY)

      // The second move lands on the hex the first move vacated
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

    it('should reject move to occupied tile of different team', () => {
      performPlace(grid, 1, 100, Team.ALLY)
      performPlace(grid, 4, 200, Team.ENEMY)

      // Occupied destinations are swap territory, cross-team included
      const result = executeMoveCharacter(grid, skillManager, 1, 4, 100)

      expect(result).toBe(false)
      expect(grid.getTileById(1).characterId).toBe(100)
      expect(grid.getTileById(4).characterId).toBe(200)
      expect(grid.teamCharacters.get(Team.ALLY)?.has(100)).toBe(true)
      expect(grid.teamCharacters.get(Team.ENEMY)?.has(200)).toBe(true)
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

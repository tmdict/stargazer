import { beforeEach, describe, expect, it, vi } from 'vitest'

import { addCompanionLink } from '@/lib/characters/companion'
import { executeMoveCharacter } from '@/lib/characters/move'
import { performPlace } from '@/lib/characters/place'
import { performRemove } from '@/lib/characters/remove'
import { Grid } from '@/lib/grid'
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

// performRemove/performPlace stay unmocked: the companion-rollback test relies
// on their real semantics to displace and restore the companion

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

    // executeMoveCharacter notifies skills through grid.skillManager, so this
    // wiring is load-bearing
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

    // BLOCKED and DEFAULT destinations both resolve to no valid team state
    it.each([
      { label: 'blocked', hexId: 6 },
      { label: 'default', hexId: 7 },
    ])('should reject move to a $label destination', ({ hexId }) => {
      performPlace(grid, 1, 100, Team.ALLY)

      const result = executeMoveCharacter(grid, skillManager, 1, hexId, 100)

      expect(result).toBe(false)
      expect(grid.getTileById(1).characterId).toBe(100)
      expect(grid.getTileById(hexId).characterId).toBeUndefined()
    })
  })

  describe('executeMoveCharacter - same team movement', () => {
    it('should move a character within its own team and update the skill manager', () => {
      performPlace(grid, 1, 100, Team.ALLY)
      expect(executeMoveCharacter(grid, skillManager, 1, 2, 100)).toBe(true)
      expect(grid.getTileById(1).characterId).toBeUndefined()
      expect(grid.getTileById(2).characterId).toBe(100)
      expect(grid.getTileById(2).team).toBe(Team.ALLY)
      expect(grid.getTileById(1).state).toBe(State.AVAILABLE_ALLY)
      expect(grid.getTileById(2).state).toBe(State.OCCUPIED_ALLY)
      expect(skillManager.updateActiveSkills).toHaveBeenCalledWith(grid)

      performPlace(grid, 4, 200, Team.ENEMY)
      expect(executeMoveCharacter(grid, skillManager, 4, 5, 200)).toBe(true)
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
  })

  describe('executeMoveCharacter - cross-team movement without skills', () => {
    it('should move characters across teams in both directions, switching membership', () => {
      performPlace(grid, 1, 100, Team.ALLY)
      expect(executeMoveCharacter(grid, skillManager, 1, 4, 100)).toBe(true)
      expect(grid.getTileById(1).characterId).toBeUndefined()
      expect(grid.getTileById(4).characterId).toBe(100)
      expect(grid.getTileById(4).team).toBe(Team.ENEMY)
      expect(grid.teamCharacters.get(Team.ALLY)?.has(100)).toBe(false)
      expect(grid.teamCharacters.get(Team.ENEMY)?.has(100)).toBe(true)

      performPlace(grid, 5, 200, Team.ENEMY)
      expect(executeMoveCharacter(grid, skillManager, 5, 1, 200)).toBe(true)
      expect(grid.getTileById(5).characterId).toBeUndefined()
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

    it('should rollback and reactivate the skill at the origin on activation failure', () => {
      performPlace(grid, 1, 100, Team.ALLY)
      skillManager.activateCharacterSkill = vi.fn().mockReturnValue(false)

      const result = executeMoveCharacter(grid, skillManager, 1, 4, 100)

      expect(result).toBe(false)
      // Character should remain at original position
      expect(grid.getTileById(1).characterId).toBe(100)
      expect(grid.getTileById(1).team).toBe(Team.ALLY)
      // The destination must be fully vacated, no duplicate left behind
      expect(grid.getTileById(4).characterId).toBeUndefined()
      expect(grid.getTileById(4).state).toBe(State.AVAILABLE_ENEMY)
      // Team membership restored: on the original team only
      expect(grid.teamCharacters.get(Team.ALLY)?.has(100)).toBe(true)
      expect(grid.teamCharacters.get(Team.ENEMY)?.has(100)).toBe(false)
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
    it('should handle character with no team gracefully', () => {
      // Manually create invalid state
      const tile = grid.getTileById(1)
      tile.characterId = 100
      tile.team = undefined
      tile.state = State.OCCUPIED_ALLY

      const result = executeMoveCharacter(grid, skillManager, 1, 2, 100)

      expect(result).toBe(false)
    })
  })
})

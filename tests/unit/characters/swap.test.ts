import { beforeEach, describe, expect, it, vi } from 'vitest'

import { addCompanionLink } from '@/lib/characters/companion'
import { toPhantimalId } from '@/lib/characters/phantimal'
import { performPlace } from '@/lib/characters/place'
import { executeSwapCharacters } from '@/lib/characters/swap'
import { Grid } from '@/lib/grid'
// Import skill functions for mocking
import { hasCompanionSkill, hasSkill, SkillManager } from '@/lib/skills/skill'
import { State } from '@/lib/types/state'
import { Team } from '@/lib/types/team'
import { STANDARD_ARENA, STANDARD_GRID, TARGETING_ARENA, TARGETING_GRID } from '../fixtures/grid'

// Mock skill-related functions
vi.mock('@/lib/skills/skill', () => ({
  hasSkill: vi.fn(),
  hasCompanionSkill: vi.fn(),
  SkillManager: vi.fn(),
}))

describe('swap.ts', () => {
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
      expect(grid.teamCharacters.get(Team.ALLY)?.has(100)).toBe(true)
      expect(grid.teamCharacters.get(Team.ALLY)?.has(200)).toBe(true)
      expect(grid.teamCharacters.get(Team.ALLY)?.size).toBe(2)
      expect(skillManager.updateActiveSkills).toHaveBeenCalledWith(grid)
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
  })

  describe('executeSwapCharacters - cross-team swaps without skills', () => {
    it('should swap ally and enemy characters, switching their teams', () => {
      performPlace(grid, 1, 100, Team.ALLY)
      performPlace(grid, 4, 200, Team.ENEMY)

      const result = executeSwapCharacters(grid, skillManager, 1, 4)

      expect(result).toBe(true)
      expect(grid.getTileById(1).characterId).toBe(200)
      expect(grid.getTileById(4).characterId).toBe(100)
      expect(grid.getTileById(1).team).toBe(Team.ALLY)
      expect(grid.getTileById(4).team).toBe(Team.ENEMY)
      // Characters switch team membership; tiles keep their occupied states
      expect(grid.teamCharacters.get(Team.ALLY)?.has(200)).toBe(true)
      expect(grid.teamCharacters.get(Team.ALLY)?.has(100)).toBe(false)
      expect(grid.teamCharacters.get(Team.ENEMY)?.has(100)).toBe(true)
      expect(grid.teamCharacters.get(Team.ENEMY)?.has(200)).toBe(false)
      expect(grid.getTileById(1).state).toBe(State.OCCUPIED_ALLY)
      expect(grid.getTileById(4).state).toBe(State.OCCUPIED_ENEMY)
    })

    it('should reject swap that would duplicate a character on the destination team', () => {
      // 100 already exists on ENEMY, so swapping its ally copy into ENEMY
      // must be rejected up front with all placements intact
      performPlace(grid, 1, 100, Team.ALLY)
      performPlace(grid, 4, 200, Team.ENEMY)
      performPlace(grid, 5, 100, Team.ENEMY)

      const result = executeSwapCharacters(grid, skillManager, 1, 4)

      expect(result).toBe(false)
      expect(grid.getTileById(1).characterId).toBe(100)
      expect(grid.getTileById(1).team).toBe(Team.ALLY)
      expect(grid.getTileById(4).characterId).toBe(200)
      expect(grid.getTileById(4).team).toBe(Team.ENEMY)
      expect(grid.getTileById(5).characterId).toBe(100)
      expect(grid.teamCharacters.get(Team.ALLY)?.has(100)).toBe(true)
      expect(grid.teamCharacters.get(Team.ENEMY)?.has(200)).toBe(true)
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
      // Characters remain at original positions after rollback
      expect(grid.getTileById(1).characterId).toBe(100)
      expect(grid.getTileById(4).characterId).toBe(200)
      expect(grid.getTileById(1).team).toBe(Team.ALLY)
      expect(grid.getTileById(4).team).toBe(Team.ENEMY)
    })

    it('should reject swap that would duplicate a character with an active skill', () => {
      // The duplicate guard rejects before any skill teardown happens
      vi.mocked(hasSkill).mockReturnValue(true)
      skillManager.hasActiveSkill = vi.fn().mockReturnValue(true)

      performPlace(grid, 1, 100, Team.ALLY)
      performPlace(grid, 4, 200, Team.ENEMY)
      performPlace(grid, 5, 100, Team.ENEMY)

      const result = executeSwapCharacters(grid, skillManager, 1, 4)

      expect(result).toBe(false)
      expect(skillManager.deactivateCharacterSkill).not.toHaveBeenCalled()
      expect(grid.getTileById(1).characterId).toBe(100)
      expect(grid.getTileById(4).characterId).toBe(200)
    })

    it('should preserve grid integrity when skill activation fails mid-swap', () => {
      // Cross-team swap with a companion skill: when re-activation fails partway,
      // the rollback path must restore exactly the original placement — no orphan
      // companions, no duplicates, no characters left at intermediate hexes.
      vi.mocked(hasSkill).mockReturnValue(true)
      vi.mocked(hasCompanionSkill).mockReturnValue(true)
      skillManager.hasActiveSkill = vi.fn().mockReturnValue(true)
      skillManager.activateCharacterSkill = vi.fn().mockReturnValue(false)

      const mainId = 100
      const companionId = grid.companionIdOffset + mainId
      const enemyId = 200

      performPlace(grid, 1, mainId, Team.ALLY)
      performPlace(grid, 2, companionId, Team.ALLY)
      performPlace(grid, 4, enemyId, Team.ENEMY)
      addCompanionLink(grid, mainId, companionId, Team.ALLY)

      const result = executeSwapCharacters(grid, skillManager, 1, 4)

      expect(result).toBe(false)

      // Main + opponent restored to original hexes / teams.
      expect(grid.getTileById(1).characterId).toBe(mainId)
      expect(grid.getTileById(1).team).toBe(Team.ALLY)
      expect(grid.getTileById(4).characterId).toBe(enemyId)
      expect(grid.getTileById(4).team).toBe(Team.ENEMY)

      // Companion is still where it started (hex 2 / ALLY) and not duplicated elsewhere.
      expect(grid.getTileById(2).characterId).toBe(companionId)
      expect(grid.getTileById(2).team).toBe(Team.ALLY)
      const companionLocations = [3, 5, 6, 7]
        .map((id) => grid.getTileById(id))
        .filter((t) => t.characterId === companionId)
      expect(companionLocations).toHaveLength(0)

      // Total character count unchanged: main + companion + enemy = 3.
      const occupied = [1, 2, 3, 4, 5, 6, 7]
        .map((id) => grid.getTileById(id))
        .filter((t) => t.characterId !== undefined)
      expect(occupied).toHaveLength(3)
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

  describe('executeSwapCharacters - phantimal handling', () => {
    const phantimalId = toPhantimalId(1)

    it('should reject cross-team swap of a character onto a phantimal', () => {
      performPlace(grid, 1, 100, Team.ALLY)
      performPlace(grid, 4, phantimalId, Team.ENEMY)

      const result = executeSwapCharacters(grid, skillManager, 1, 4)

      expect(result).toBe(false)
      expect(grid.getTileById(1).characterId).toBe(100)
      expect(grid.getTileById(1).team).toBe(Team.ALLY)
      expect(grid.getTileById(4).characterId).toBe(phantimalId)
      expect(grid.getTileById(4).team).toBe(Team.ENEMY)
    })

    it('should reject swap initiated from a phantimal', () => {
      performPlace(grid, 1, phantimalId, Team.ALLY)
      performPlace(grid, 4, 200, Team.ENEMY)

      const result = executeSwapCharacters(grid, skillManager, 1, 4)

      expect(result).toBe(false)
      expect(grid.getTileById(1).characterId).toBe(phantimalId)
      expect(grid.getTileById(4).characterId).toBe(200)
    })

    it('should reject phantimal-phantimal swap', () => {
      const enemyPhantimalId = toPhantimalId(2)
      performPlace(grid, 1, phantimalId, Team.ALLY)
      performPlace(grid, 4, enemyPhantimalId, Team.ENEMY)

      const result = executeSwapCharacters(grid, skillManager, 1, 4)

      expect(result).toBe(false)
      expect(grid.getTileById(1).characterId).toBe(phantimalId)
      expect(grid.getTileById(4).characterId).toBe(enemyPhantimalId)
    })

    it('should reject same-team character-phantimal swap', () => {
      performPlace(grid, 1, 100, Team.ALLY)
      performPlace(grid, 2, phantimalId, Team.ALLY)

      const result = executeSwapCharacters(grid, skillManager, 1, 2)

      expect(result).toBe(false)
      expect(grid.getTileById(1).characterId).toBe(100)
      expect(grid.getTileById(2).characterId).toBe(phantimalId)
    })

    it('should leave a full team fully intact when swapping a character onto its phantimal', () => {
      // Phantimals are exempt from team-size tracking, so swapping a character
      // onto a full team's phantimal frees no slot and the swap cannot succeed.
      // The guard must reject it up front with zero state changes.
      const tGrid = new Grid(TARGETING_GRID, TARGETING_ARENA)
      tGrid.skillManager = skillManager

      performPlace(tGrid, 1, 100, Team.ALLY)
      const enemyChars = [201, 202, 203, 204, 205]
      enemyChars.forEach((charId, i) => performPlace(tGrid, 9 + i, charId, Team.ENEMY))
      performPlace(tGrid, 14, phantimalId, Team.ENEMY)

      const result = executeSwapCharacters(tGrid, skillManager, 1, 14)

      expect(result).toBe(false)
      expect(tGrid.getTileById(1).characterId).toBe(100)
      expect(tGrid.getTileById(1).team).toBe(Team.ALLY)
      expect(tGrid.getTileById(14).characterId).toBe(phantimalId)
      expect(tGrid.getTileById(14).team).toBe(Team.ENEMY)
      expect(tGrid.teamCharacters.get(Team.ALLY)?.has(100)).toBe(true)
      enemyChars.forEach((charId, i) => {
        expect(tGrid.getTileById(9 + i).characterId).toBe(charId)
        expect(tGrid.teamCharacters.get(Team.ENEMY)?.has(charId)).toBe(true)
      })
      // Phantimals never appear in team-size tracking
      expect(tGrid.teamCharacters.get(Team.ALLY)?.has(phantimalId)).toBe(false)
      expect(tGrid.teamCharacters.get(Team.ENEMY)?.has(phantimalId)).toBe(false)
    })
  })

  describe('Edge cases', () => {
    it('should handle empty grid', () => {
      const emptyGrid = new Grid({ hex: [[]], qOffset: [0] }, { name: 'Empty', grid: [] })
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

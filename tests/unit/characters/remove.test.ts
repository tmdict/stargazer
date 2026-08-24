import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  findCharacterHex,
  getMaxTeamSize,
  getTilesWithCharacters,
  isCharacterOnTeam,
} from '@/lib/characters/character'
import { executePlaceCharacter, performPlace } from '@/lib/characters/place'
import {
  executeClearAllCharacters,
  executeRemoveCharacter,
  performClearAll,
  performRemove,
} from '@/lib/characters/remove'
import { Grid } from '@/lib/grid'
import { SkillManager } from '@/lib/skills/skill'
import { State } from '@/lib/types/state'
import { Team } from '@/lib/types/team'
import { ALLY_A, ALLY_B, ENEMY_A, PHRAESTO, PHRAESTO_COMPANION } from '../fixtures/characters'
import { STANDARD_ARENA, STANDARD_GRID } from '../fixtures/grid'

// Runs against the real SkillManager and skill registry: the fixture ids have
// no registered skill; Phraesto's companion spawn makes skill teardown
// observable (companion tile, capacity bonus).

describe('remove.ts', () => {
  let grid: Grid
  let skillManager: SkillManager

  beforeEach(() => {
    grid = new Grid(STANDARD_GRID, STANDARD_ARENA)
    skillManager = new SkillManager()
    grid.skillManager = skillManager
  })

  describe('performRemove', () => {
    it('should remove the character, clearing team membership and restoring tile state', () => {
      performPlace(grid, 1, ALLY_A, Team.ALLY)
      expect(isCharacterOnTeam(grid, ALLY_A, Team.ALLY)).toBe(true)

      const result = performRemove(grid, 1)

      expect(result).toBe(true)
      const tile = grid.getTileById(1)
      expect(tile.characterId).toBeUndefined()
      expect(tile.team).toBeUndefined()
      expect(tile.state).toBe(State.AVAILABLE_ALLY)
      expect(isCharacterOnTeam(grid, ALLY_A, Team.ALLY)).toBe(false)

      performPlace(grid, 4, ENEMY_A, Team.ENEMY)
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
    it('should remove regular character and refresh active skills', () => {
      performPlace(grid, 1, ALLY_A, Team.ALLY)
      const update = vi.spyOn(skillManager, 'updateActiveSkills')

      const result = executeRemoveCharacter(grid, skillManager, 1)

      expect(result).toBe(true)
      expect(grid.getTileById(1).characterId).toBeUndefined()
      expect(update).toHaveBeenCalledWith(grid)
    })

    it('should return true when tile has no character', () => {
      const result = executeRemoveCharacter(grid, skillManager, 1)

      expect(result).toBe(true)
    })

    it('should return true when character has no team', () => {
      // Manually create invalid state
      const tile = grid.getTileById(1)
      tile.characterId = ALLY_A
      tile.team = undefined

      const result = executeRemoveCharacter(grid, skillManager, 1)

      expect(result).toBe(true)
    })

    it('should deactivate the skill on removal', () => {
      executePlaceCharacter(grid, skillManager, 1, PHRAESTO, Team.ALLY)
      expect(skillManager.hasActiveSkill(PHRAESTO, Team.ALLY)).toBe(true)

      const result = executeRemoveCharacter(grid, skillManager, 1)

      expect(result).toBe(true)
      expect(skillManager.hasActiveSkill(PHRAESTO)).toBe(false)
      // Teardown removed the companion and the capacity bonus with it
      expect(findCharacterHex(grid, PHRAESTO_COMPANION, Team.ALLY)).toBeNull()
      expect(getMaxTeamSize(grid, Team.ALLY)).toBe(5)
    })

    it('should handle companion removal by removing the main character', () => {
      executePlaceCharacter(grid, skillManager, 1, PHRAESTO, Team.ALLY)
      const companionHex = findCharacterHex(grid, PHRAESTO_COMPANION, Team.ALLY)!

      const result = executeRemoveCharacter(grid, skillManager, companionHex)

      expect(result).toBe(true)
      expect(grid.getTileById(1).characterId).toBeUndefined()
      expect(grid.getTileById(companionHex).characterId).toBeUndefined()
      expect(skillManager.hasActiveSkill(PHRAESTO)).toBe(false)
    })

    it('should remove orphaned companion directly', () => {
      const companionId = grid.companionIdOffset + ALLY_A

      // Place only companion (no main character)
      performPlace(grid, 2, companionId, Team.ALLY)

      const result = executeRemoveCharacter(grid, skillManager, 2)

      expect(result).toBe(true)
      expect(grid.getTileById(2).characterId).toBeUndefined()
    })

    it('should handle a character already removed by skill deactivation', () => {
      // No registered skill removes its own caster on deactivation, so this
      // defensive branch needs a stubbed teardown to be reachable.
      performPlace(grid, 1, PHRAESTO, Team.ALLY)
      vi.spyOn(skillManager, 'deactivateCharacterSkill').mockImplementation(() => {
        performRemove(grid, 1)
      })

      const result = executeRemoveCharacter(grid, skillManager, 1)

      expect(result).toBe(true)
      expect(grid.getTileById(1).characterId).toBeUndefined()
    })
  })

  describe('performClearAll', () => {
    it('should clear all characters and tile states, then update skills', () => {
      performPlace(grid, 1, ALLY_A, Team.ALLY)
      performPlace(grid, 2, ALLY_B, Team.ALLY)
      performPlace(grid, 4, ENEMY_A, Team.ENEMY)
      const update = vi.spyOn(skillManager, 'updateActiveSkills')

      const result = performClearAll(grid)

      expect(result).toBe(true)
      expect(grid.getTileById(1).characterId).toBeUndefined()
      expect(grid.getTileById(2).characterId).toBeUndefined()
      expect(grid.getTileById(4).characterId).toBeUndefined()
      expect(getTilesWithCharacters(grid)).toHaveLength(0)
      expect(grid.getTileById(1).state).toBe(State.AVAILABLE_ALLY)
      expect(grid.getTileById(4).state).toBe(State.AVAILABLE_ENEMY)
      expect(update).toHaveBeenCalledWith(grid)
    })

    it('should return true when grid is already empty', () => {
      const result = performClearAll(grid)

      expect(result).toBe(true)
    })
  })

  describe('executeClearAllCharacters', () => {
    it('should deactivate all skills on clear', () => {
      executePlaceCharacter(grid, skillManager, 1, PHRAESTO, Team.ALLY)
      performPlace(grid, 4, ENEMY_A, Team.ENEMY)

      const result = executeClearAllCharacters(grid, skillManager)

      expect(result).toBe(true)
      expect(getTilesWithCharacters(grid)).toHaveLength(0)
      expect(skillManager.hasActiveSkill(PHRAESTO)).toBe(false)
      expect(getMaxTeamSize(grid, Team.ALLY)).toBe(5)
    })
  })
})

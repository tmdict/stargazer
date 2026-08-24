import { beforeEach, describe, expect, it, vi } from 'vitest'

import { findCharacterHex, getMaxTeamSize, isCharacterOnTeam } from '@/lib/characters/character'
import { executeMoveCharacter } from '@/lib/characters/move'
import { executePlaceCharacter, performPlace } from '@/lib/characters/place'
import { Grid } from '@/lib/grid'
import { SkillManager } from '@/lib/skills/skill'
import { SKILL_COLORS } from '@/lib/skills/utils/colors'
import { State } from '@/lib/types/state'
import { Team } from '@/lib/types/team'
import { ALLY_A, ALLY_B, ENEMY_A, PHRAESTO, PHRAESTO_COMPANION } from '../fixtures/characters'
import { STANDARD_ARENA, STANDARD_GRID } from '../fixtures/grid'

// Runs against the real SkillManager and skill registry: the fixture ids have
// no registered skill, and Phraesto drives the cross-team lifecycle tests
// because his companion spawn is observable and throws for real when the
// destination team has no free tile.

describe('move.ts', () => {
  let grid: Grid
  let skillManager: SkillManager

  beforeEach(() => {
    grid = new Grid(STANDARD_GRID, STANDARD_ARENA)
    skillManager = new SkillManager()
    // executeMoveCharacter notifies skills through grid.skillManager, so this
    // wiring is load-bearing
    grid.skillManager = skillManager
  })

  describe('executeMoveCharacter - basic validation', () => {
    it('should reject move to same hex', () => {
      performPlace(grid, 1, ALLY_A, Team.ALLY)

      const result = executeMoveCharacter(grid, skillManager, 1, 1, ALLY_A)

      expect(result).toBe(false)
      expect(grid.getTileById(1).characterId).toBe(ALLY_A)
    })

    it('should reject move when the source does not hold the character', () => {
      performPlace(grid, 1, ALLY_A, Team.ALLY)

      const result = executeMoveCharacter(grid, skillManager, 1, 2, ALLY_B)

      expect(result).toBe(false)
      expect(grid.getTileById(1).characterId).toBe(ALLY_A)
      expect(grid.getTileById(2).characterId).toBeUndefined()

      // An empty source resolves to the same identity-mismatch guard
      expect(executeMoveCharacter(grid, skillManager, 3, 2, ALLY_A)).toBe(false)
    })

    // BLOCKED and DEFAULT destinations both resolve to no valid team state
    it.each([
      { label: 'blocked', hexId: 6 },
      { label: 'default', hexId: 7 },
    ])('should reject move to a $label destination', ({ hexId }) => {
      performPlace(grid, 1, ALLY_A, Team.ALLY)

      const result = executeMoveCharacter(grid, skillManager, 1, hexId, ALLY_A)

      expect(result).toBe(false)
      expect(grid.getTileById(1).characterId).toBe(ALLY_A)
      expect(grid.getTileById(hexId).characterId).toBeUndefined()
    })
  })

  describe('executeMoveCharacter - same team movement', () => {
    it('should move a character within its own team and refresh active skills', () => {
      const update = vi.spyOn(skillManager, 'updateActiveSkills')
      performPlace(grid, 1, ALLY_A, Team.ALLY)
      expect(executeMoveCharacter(grid, skillManager, 1, 2, ALLY_A)).toBe(true)
      expect(grid.getTileById(1).characterId).toBeUndefined()
      expect(grid.getTileById(2).characterId).toBe(ALLY_A)
      expect(grid.getTileById(2).team).toBe(Team.ALLY)
      expect(grid.getTileById(1).state).toBe(State.AVAILABLE_ALLY)
      expect(grid.getTileById(2).state).toBe(State.OCCUPIED_ALLY)
      expect(update).toHaveBeenCalledWith(grid)

      performPlace(grid, 4, ENEMY_A, Team.ENEMY)
      expect(executeMoveCharacter(grid, skillManager, 4, 5, ENEMY_A)).toBe(true)
      expect(grid.getTileById(4).characterId).toBeUndefined()
      expect(grid.getTileById(5).characterId).toBe(ENEMY_A)
      expect(grid.getTileById(5).team).toBe(Team.ENEMY)
    })

    it('should reject move onto an occupied destination', () => {
      performPlace(grid, 1, ALLY_A, Team.ALLY)
      performPlace(grid, 2, ALLY_B, Team.ALLY)

      // Occupied destinations are swap territory; a move never displaces a unit
      const result = executeMoveCharacter(grid, skillManager, 1, 2, ALLY_A)

      expect(result).toBe(false)
      expect(grid.getTileById(1).characterId).toBe(ALLY_A)
      expect(grid.getTileById(2).characterId).toBe(ALLY_B)
      expect(isCharacterOnTeam(grid, ALLY_A, Team.ALLY)).toBe(true)
      expect(isCharacterOnTeam(grid, ALLY_B, Team.ALLY)).toBe(true)
    })
  })

  describe('executeMoveCharacter - cross-team movement without skills', () => {
    it('should move characters across teams in both directions, switching membership', () => {
      performPlace(grid, 1, ALLY_A, Team.ALLY)
      expect(executeMoveCharacter(grid, skillManager, 1, 4, ALLY_A)).toBe(true)
      expect(grid.getTileById(1).characterId).toBeUndefined()
      expect(grid.getTileById(4).characterId).toBe(ALLY_A)
      expect(grid.getTileById(4).team).toBe(Team.ENEMY)
      expect(isCharacterOnTeam(grid, ALLY_A, Team.ALLY)).toBe(false)
      expect(isCharacterOnTeam(grid, ALLY_A, Team.ENEMY)).toBe(true)

      performPlace(grid, 5, ENEMY_A, Team.ENEMY)
      expect(executeMoveCharacter(grid, skillManager, 5, 1, ENEMY_A)).toBe(true)
      expect(grid.getTileById(5).characterId).toBeUndefined()
      expect(grid.getTileById(1).characterId).toBe(ENEMY_A)
      expect(grid.getTileById(1).team).toBe(Team.ALLY)
      expect(isCharacterOnTeam(grid, ENEMY_A, Team.ENEMY)).toBe(false)
      expect(isCharacterOnTeam(grid, ENEMY_A, Team.ALLY)).toBe(true)
    })
  })

  describe('executeMoveCharacter - cross-team movement with skills', () => {
    it('should deactivate the skill on the old team and reactivate on the new', () => {
      executePlaceCharacter(grid, skillManager, 1, PHRAESTO, Team.ALLY)

      const result = executeMoveCharacter(grid, skillManager, 1, 4, PHRAESTO)

      expect(result).toBe(true)
      expect(skillManager.hasActiveSkill(PHRAESTO, Team.ALLY)).toBe(false)
      expect(skillManager.getActiveSkillInfo(PHRAESTO, Team.ENEMY)).toEqual({
        hexId: 4,
        team: Team.ENEMY,
      })
      // The companion follows: gone from the ally side, respawned enemy-side
      // (hex 5 is the only free enemy tile)
      expect(findCharacterHex(grid, PHRAESTO_COMPANION, Team.ALLY)).toBeNull()
      expect(findCharacterHex(grid, PHRAESTO_COMPANION, Team.ENEMY)).toBe(5)
      expect(getMaxTeamSize(grid, Team.ALLY)).toBe(5)
      expect(getMaxTeamSize(grid, Team.ENEMY)).toBe(6)
    })

    it('should rollback and reactivate the skill at the origin on activation failure', () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {})
      executePlaceCharacter(grid, skillManager, 1, PHRAESTO, Team.ALLY)
      const companionHex = findCharacterHex(grid, PHRAESTO_COMPANION, Team.ALLY)!
      performPlace(grid, 5, ENEMY_A, Team.ENEMY)

      // After the move no enemy tile is free for the companion: the
      // reactivation throws and the transaction rolls back
      const result = executeMoveCharacter(grid, skillManager, 1, 4, PHRAESTO)

      expect(result).toBe(false)
      expect(grid.getTileById(1).characterId).toBe(PHRAESTO)
      expect(grid.getTileById(1).team).toBe(Team.ALLY)
      // The destination must be fully vacated, no duplicate left behind
      expect(grid.getTileById(4).characterId).toBeUndefined()
      expect(grid.getTileById(4).state).toBe(State.AVAILABLE_ENEMY)
      expect(isCharacterOnTeam(grid, PHRAESTO, Team.ENEMY)).toBe(false)
      // Skill reactivated on the original team with its companion restored
      expect(skillManager.getActiveSkillInfo(PHRAESTO, Team.ALLY)).toEqual({
        hexId: 1,
        team: Team.ALLY,
      })
      expect(findCharacterHex(grid, PHRAESTO_COMPANION, Team.ALLY)).toBe(companionHex)
      error.mockRestore()
    })
  })

  describe('executeMoveCharacter - companion handling', () => {
    it('should prevent companions from changing teams', () => {
      const companionId = grid.companionIdOffset + ALLY_A
      performPlace(grid, 1, companionId, Team.ALLY)

      const result = executeMoveCharacter(grid, skillManager, 1, 4, companionId)

      expect(result).toBe(false)
      expect(grid.getTileById(1).characterId).toBe(companionId)
      expect(grid.getTileById(4).characterId).toBeUndefined()
    })

    it('should allow companions to move within same team', () => {
      const companionId = grid.companionIdOffset + ALLY_A
      performPlace(grid, 1, companionId, Team.ALLY)

      const result = executeMoveCharacter(grid, skillManager, 1, 2, companionId)

      expect(result).toBe(true)
      expect(grid.getTileById(1).characterId).toBeUndefined()
      expect(grid.getTileById(2).characterId).toBe(companionId)
    })

    it('should restore a displaced companion to its stored hex on rollback', () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {})
      // Deterministic spawns: the first pick (initial spawn) takes the first
      // free ally tile, later picks (the rollback re-spawn) take the last, so
      // the re-spawn lands on the other tile and restoreCompanions must move
      // the companion back to its stored hex.
      const random = vi.spyOn(Math, 'random')
      random.mockReturnValueOnce(0).mockReturnValue(0.99)

      executePlaceCharacter(grid, skillManager, 1, PHRAESTO, Team.ALLY)
      const storedHex = findCharacterHex(grid, PHRAESTO_COMPANION, Team.ALLY)!
      const otherHex = storedHex === 2 ? 3 : 2
      performPlace(grid, 5, ENEMY_A, Team.ENEMY) // block the enemy-side spawn

      const result = executeMoveCharacter(grid, skillManager, 1, 4, PHRAESTO)

      expect(result).toBe(false)
      expect(grid.getTileById(1).characterId).toBe(PHRAESTO)
      expect(findCharacterHex(grid, PHRAESTO_COMPANION, Team.ALLY)).toBe(storedHex)
      expect(grid.getTileById(otherHex).characterId).toBeUndefined()
      // The restored companion keeps its color modifier
      expect(
        skillManager
          .getColorModifiersByCharacterAndTeam()
          .get(`${PHRAESTO_COMPANION}-${Team.ALLY}`),
      ).toBe(SKILL_COLORS.crimson)
      random.mockRestore()
      error.mockRestore()
    })
  })

  describe('Edge cases', () => {
    it('should handle character with no team gracefully', () => {
      // Manually create invalid state
      const tile = grid.getTileById(1)
      tile.characterId = ALLY_A
      tile.team = undefined
      tile.state = State.OCCUPIED_ALLY

      const result = executeMoveCharacter(grid, skillManager, 1, 2, ALLY_A)

      expect(result).toBe(false)
    })
  })
})

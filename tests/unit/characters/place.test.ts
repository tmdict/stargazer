import { beforeEach, describe, expect, it, vi } from 'vitest'

import { findCharacterHex, getMaxTeamSize, isCharacterOnTeam } from '@/lib/characters/character'
import {
  executeAutoPlaceCharacter,
  executePlaceCharacter,
  performPlace,
} from '@/lib/characters/place'
import { Grid } from '@/lib/grid'
import { SkillManager } from '@/lib/skills/skill'
import { State } from '@/lib/types/state'
import { Team } from '@/lib/types/team'
import {
  ALLY_A,
  ALLY_B,
  ALLY_C,
  ENEMY_A,
  GUNNAR,
  PHRAESTO,
  PHRAESTO_COMPANION,
} from '../fixtures/characters'
import { STANDARD_ARENA, STANDARD_GRID } from '../fixtures/grid'

// Runs against the real SkillManager and skill registry: the fixture ids have
// no registered skill, and Phraesto drives the lifecycle tests because his
// companion spawn is observable (companion tile, capacity bonus) and throws
// for real when no free same-team tile exists.

describe('place.ts', () => {
  let grid: Grid
  let skillManager: SkillManager

  beforeEach(() => {
    grid = new Grid(STANDARD_GRID, STANDARD_ARENA)
    skillManager = new SkillManager()
    grid.skillManager = skillManager
  })

  describe('performPlace', () => {
    it.each([
      { label: 'ally', team: Team.ALLY, hexId: 1, state: State.OCCUPIED_ALLY },
      { label: 'enemy', team: Team.ENEMY, hexId: 4, state: State.OCCUPIED_ENEMY },
    ])('should successfully place character on available $label tile', ({ team, hexId, state }) => {
      const result = performPlace(grid, hexId, ALLY_A, team)

      expect(result).toBe(true)
      const tile = grid.getTileById(hexId)
      expect(tile.characterId).toBe(ALLY_A)
      expect(tile.team).toBe(team)
      expect(tile.state).toBe(state)
      expect(isCharacterOnTeam(grid, ALLY_A, team)).toBe(true)
    })

    it('should reject placement on an occupied tile', () => {
      performPlace(grid, 1, ALLY_A, Team.ALLY)
      expect(isCharacterOnTeam(grid, ALLY_A, Team.ALLY)).toBe(true)

      // The atomic primitive never displaces an existing unit;
      // replacement is the skill-aware composite in executePlaceCharacter
      const result = performPlace(grid, 1, ALLY_B, Team.ALLY)

      expect(result).toBe(false)
      const tile = grid.getTileById(1)
      expect(tile.characterId).toBe(ALLY_A)
      expect(isCharacterOnTeam(grid, ALLY_A, Team.ALLY)).toBe(true)
      expect(isCharacterOnTeam(grid, ALLY_B, Team.ALLY)).toBe(false)
    })

    it('should reject invalid character ID', () => {
      expect(performPlace(grid, 1, 0, Team.ALLY)).toBe(false)
      expect(performPlace(grid, 1, -1, Team.ALLY)).toBe(false)
      expect(performPlace(grid, 1, 1.5, Team.ALLY)).toBe(false)
      expect(performPlace(grid, 1, NaN, Team.ALLY)).toBe(false)
    })

    // Rule variants live in character.test.ts (canPlaceCharacterOnTile/OnTeam);
    // these two pin only that performPlace consults those rules.
    it('should reject placement on wrong-team, blocked, or default tiles', () => {
      expect(performPlace(grid, 4, ALLY_A, Team.ALLY)).toBe(false)
      expect(performPlace(grid, 1, ENEMY_A, Team.ENEMY)).toBe(false)
      expect(performPlace(grid, 6, ALLY_A, Team.ALLY)).toBe(false)
      expect(performPlace(grid, 7, ALLY_A, Team.ALLY)).toBe(false)
    })

    it('should enforce team rules (size limit, duplicates)', () => {
      grid.maxTeamSizes.set(Team.ALLY, 2)

      expect(performPlace(grid, 1, ALLY_A, Team.ALLY)).toBe(true)
      expect(performPlace(grid, 2, ALLY_A, Team.ALLY)).toBe(false)
      expect(performPlace(grid, 2, ALLY_B, Team.ALLY)).toBe(true)
      expect(performPlace(grid, 3, ALLY_C, Team.ALLY)).toBe(false)
    })

    it('should allow same character ID on different teams', () => {
      expect(performPlace(grid, 1, ALLY_A, Team.ALLY)).toBe(true)
      expect(performPlace(grid, 4, ALLY_A, Team.ENEMY)).toBe(true)

      expect(isCharacterOnTeam(grid, ALLY_A, Team.ALLY)).toBe(true)
      expect(isCharacterOnTeam(grid, ALLY_A, Team.ENEMY)).toBe(true)
    })
  })

  describe('executePlaceCharacter', () => {
    it('should place a character without a skill, leaving no active-skill entry', () => {
      const result = executePlaceCharacter(grid, skillManager, 1, ALLY_A, Team.ALLY)

      expect(result).toBe(true)
      const tile = grid.getTileById(1)
      expect(tile.characterId).toBe(ALLY_A)
      expect(tile.team).toBe(Team.ALLY)
      expect(skillManager.hasActiveSkill(ALLY_A)).toBe(false)
    })

    it('should activate the skill on placement', () => {
      const result = executePlaceCharacter(grid, skillManager, 1, PHRAESTO, Team.ALLY)

      expect(result).toBe(true)
      expect(skillManager.getActiveSkillInfo(PHRAESTO, Team.ALLY)).toEqual({
        hexId: 1,
        team: Team.ALLY,
      })
      expect(findCharacterHex(grid, PHRAESTO_COMPANION, Team.ALLY)).not.toBeNull()
      expect(getMaxTeamSize(grid, Team.ALLY)).toBe(6)
    })

    it('should reject companion IDs', () => {
      const companionId = grid.companionIdOffset + ALLY_A
      const result = executePlaceCharacter(grid, skillManager, 1, companionId, Team.ALLY)

      expect(result).toBe(false)
      expect(grid.getTileById(1).characterId).toBeUndefined()
    })

    it('should replace an occupant with full skill cleanup', () => {
      executePlaceCharacter(grid, skillManager, 1, PHRAESTO, Team.ALLY)

      const result = executePlaceCharacter(grid, skillManager, 1, ALLY_B, Team.ALLY)

      expect(result).toBe(true)
      expect(grid.getTileById(1).characterId).toBe(ALLY_B)
      expect(isCharacterOnTeam(grid, PHRAESTO, Team.ALLY)).toBe(false)
      expect(isCharacterOnTeam(grid, ALLY_B, Team.ALLY)).toBe(true)
      // Teardown removed the companion and the capacity bonus with it
      expect(skillManager.hasActiveSkill(PHRAESTO)).toBe(false)
      expect(findCharacterHex(grid, PHRAESTO_COMPANION, Team.ALLY)).toBeNull()
      expect(getMaxTeamSize(grid, Team.ALLY)).toBe(5)
    })

    it('should restore the occupant when the new character skill activation fails', () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {})
      executePlaceCharacter(grid, skillManager, 1, GUNNAR, Team.ALLY)
      performPlace(grid, 2, ALLY_A, Team.ALLY)
      performPlace(grid, 3, ALLY_B, Team.ALLY)

      // No free ally tile for Phraesto's companion: activation throws, rollback
      const result = executePlaceCharacter(grid, skillManager, 1, PHRAESTO, Team.ALLY)

      expect(result).toBe(false)
      // Occupant fully restored: tile, team membership, skill reactivated
      expect(grid.getTileById(1).characterId).toBe(GUNNAR)
      expect(isCharacterOnTeam(grid, GUNNAR, Team.ALLY)).toBe(true)
      expect(isCharacterOnTeam(grid, PHRAESTO, Team.ALLY)).toBe(false)
      expect(skillManager.getActiveSkillInfo(GUNNAR, Team.ALLY)).toEqual({
        hexId: 1,
        team: Team.ALLY,
      })
      error.mockRestore()
    })

    it('should cascade a companion occupant to its main character', () => {
      executePlaceCharacter(grid, skillManager, 1, PHRAESTO, Team.ALLY)
      const companionHex = findCharacterHex(grid, PHRAESTO_COMPANION, Team.ALLY)!

      const result = executePlaceCharacter(grid, skillManager, companionHex, ALLY_B, Team.ALLY)

      expect(result).toBe(true)
      // Replacing the companion removes the whole unit, anchored on the main
      expect(grid.getTileById(1).characterId).toBeUndefined()
      expect(grid.getTileById(companionHex).characterId).toBe(ALLY_B)
      expect(isCharacterOnTeam(grid, PHRAESTO, Team.ALLY)).toBe(false)
      expect(isCharacterOnTeam(grid, PHRAESTO_COMPANION, Team.ALLY)).toBe(false)
      expect(skillManager.hasActiveSkill(PHRAESTO)).toBe(false)
      expect(getMaxTeamSize(grid, Team.ALLY)).toBe(5)
    })

    it('should rollback on skill activation failure', () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {})
      performPlace(grid, 2, ALLY_A, Team.ALLY)
      performPlace(grid, 3, ALLY_B, Team.ALLY)

      const result = executePlaceCharacter(grid, skillManager, 1, PHRAESTO, Team.ALLY)

      expect(result).toBe(false)
      const tile = grid.getTileById(1)
      expect(tile.characterId).toBeUndefined()
      expect(tile.state).toBe(State.AVAILABLE_ALLY)
      expect(skillManager.hasActiveSkill(PHRAESTO)).toBe(false)
      error.mockRestore()
    })

    it('should replace an occupant when the team is at max capacity', () => {
      // Occupant removal precedes the capacity check, so replacement on a
      // full team must succeed rather than trip the team size limit
      grid.maxTeamSizes.set(Team.ALLY, 1)
      performPlace(grid, 1, ALLY_A, Team.ALLY)

      const result = executePlaceCharacter(grid, skillManager, 1, ALLY_B, Team.ALLY)

      expect(result).toBe(true)
      expect(grid.getTileById(1).characterId).toBe(ALLY_B)
      expect(isCharacterOnTeam(grid, ALLY_A, Team.ALLY)).toBe(false)
      expect(isCharacterOnTeam(grid, ALLY_B, Team.ALLY)).toBe(true)
    })

    it('should use default team ALLY when not specified', () => {
      const result = executePlaceCharacter(grid, skillManager, 1, ALLY_A)

      expect(result).toBe(true)
      const tile = grid.getTileById(1)
      expect(tile.team).toBe(Team.ALLY)
    })
  })

  describe('executeAutoPlaceCharacter', () => {
    it.each([
      { team: Team.ALLY, hexes: [1, 2, 3] },
      { team: Team.ENEMY, hexes: [4, 5] },
    ])('should place on a random available tile of team $team', ({ team, hexes }) => {
      const result = executeAutoPlaceCharacter(grid, skillManager, ALLY_A, team)

      expect(result).toBe(true)
      expect(hexes.some((hexId) => grid.getTileById(hexId).characterId === ALLY_A)).toBe(true)
    })

    it('should reject when character cannot be placed on team', () => {
      // Fill team to capacity
      grid.maxTeamSizes.set(Team.ALLY, 2)
      performPlace(grid, 1, ALLY_A, Team.ALLY)
      performPlace(grid, 2, ALLY_B, Team.ALLY)

      const result = executeAutoPlaceCharacter(grid, skillManager, ALLY_C, Team.ALLY)

      expect(result).toBe(false)
    })

    it('should reject when no tiles available', () => {
      performPlace(grid, 1, ALLY_A, Team.ALLY)
      performPlace(grid, 2, ALLY_B, Team.ALLY)
      performPlace(grid, 3, ALLY_C, Team.ALLY)

      const result = executeAutoPlaceCharacter(grid, skillManager, GUNNAR, Team.ALLY)

      expect(result).toBe(false)
    })

    it('should activate the skill after auto-placement', () => {
      const result = executeAutoPlaceCharacter(grid, skillManager, PHRAESTO, Team.ALLY)

      expect(result).toBe(true)
      expect(skillManager.hasActiveSkill(PHRAESTO, Team.ALLY)).toBe(true)
      expect(findCharacterHex(grid, PHRAESTO_COMPANION, Team.ALLY)).not.toBeNull()
    })

    it('should rollback placement on skill activation failure', () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {})
      // Only hex 1 stays free: the companion spawn finds no second tile
      performPlace(grid, 2, ALLY_A, Team.ALLY)
      performPlace(grid, 3, ALLY_B, Team.ALLY)

      const result = executeAutoPlaceCharacter(grid, skillManager, PHRAESTO, Team.ALLY)

      expect(result).toBe(false)
      expect(isCharacterOnTeam(grid, PHRAESTO, Team.ALLY)).toBe(false)
      expect(grid.getTileById(1).characterId).toBeUndefined()
      error.mockRestore()
    })
  })
})

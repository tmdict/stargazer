import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  findCharacterHex,
  getAvailableTeamSize,
  getTilesWithCharacters,
  isCharacterOnTeam,
} from '@/lib/characters/character'
import { toPhantimalId } from '@/lib/characters/phantimal'
import { executePlaceCharacter, performPlace } from '@/lib/characters/place'
import { executeSwapCharacters } from '@/lib/characters/swap'
import { Grid } from '@/lib/grid'
import { SkillManager } from '@/lib/skills/skill'
import { State } from '@/lib/types/state'
import { Team } from '@/lib/types/team'
import {
  ALLY_A,
  ALLY_B,
  ENEMY_A,
  ENEMY_B,
  GUNNAR,
  PHRAESTO,
  PHRAESTO_COMPANION,
} from '../fixtures/characters'
import { STANDARD_ARENA, STANDARD_GRID, TARGETING_ARENA, TARGETING_GRID } from '../fixtures/grid'

// Runs against the real SkillManager and skill registry: the fixture ids have
// no registered skill, and Phraesto drives the cross-team lifecycle tests
// because his companion spawn is observable and throws for real when the
// destination team has no free tile.

describe('swap.ts', () => {
  let grid: Grid
  let skillManager: SkillManager

  beforeEach(() => {
    grid = new Grid(STANDARD_GRID, STANDARD_ARENA)
    skillManager = new SkillManager()
    grid.skillManager = skillManager
  })

  describe('executeSwapCharacters - basic validation', () => {
    it('should reject swap on same hex', () => {
      performPlace(grid, 1, ALLY_A, Team.ALLY)

      const result = executeSwapCharacters(grid, skillManager, 1, 1)

      expect(result).toBe(false)
      expect(grid.getTileById(1).characterId).toBe(ALLY_A)
    })

    it('should reject swap when either hex has no character', () => {
      performPlace(grid, 1, ALLY_A, Team.ALLY)

      expect(executeSwapCharacters(grid, skillManager, 1, 2)).toBe(false)
      expect(executeSwapCharacters(grid, skillManager, 2, 1)).toBe(false)
      expect(grid.getTileById(1).characterId).toBe(ALLY_A)
    })

    it('should reject swap when either character has no team', () => {
      // Manually create invalid state
      const tile1 = grid.getTileById(1)
      tile1.characterId = ALLY_A
      tile1.team = undefined
      tile1.state = State.OCCUPIED_ALLY

      performPlace(grid, 2, ALLY_B, Team.ALLY)

      const result = executeSwapCharacters(grid, skillManager, 1, 2)

      expect(result).toBe(false)
    })
  })

  describe('executeSwapCharacters - same team swaps', () => {
    it('should swap two characters within a team', () => {
      const update = vi.spyOn(skillManager, 'updateActiveSkills')
      performPlace(grid, 1, ALLY_A, Team.ALLY)
      performPlace(grid, 2, ALLY_B, Team.ALLY)

      const result = executeSwapCharacters(grid, skillManager, 1, 2)

      expect(result).toBe(true)
      expect(grid.getTileById(1).characterId).toBe(ALLY_B)
      expect(grid.getTileById(2).characterId).toBe(ALLY_A)
      expect(grid.getTileById(1).team).toBe(Team.ALLY)
      expect(grid.getTileById(2).team).toBe(Team.ALLY)
      expect(isCharacterOnTeam(grid, ALLY_A, Team.ALLY)).toBe(true)
      expect(isCharacterOnTeam(grid, ALLY_B, Team.ALLY)).toBe(true)
      expect(getAvailableTeamSize(grid, Team.ALLY)).toBe(3)
      expect(update).toHaveBeenCalledWith(grid)

      performPlace(grid, 4, ENEMY_A, Team.ENEMY)
      performPlace(grid, 5, ENEMY_B, Team.ENEMY)
      expect(executeSwapCharacters(grid, skillManager, 4, 5)).toBe(true)
      expect(grid.getTileById(4).characterId).toBe(ENEMY_B)
      expect(grid.getTileById(5).characterId).toBe(ENEMY_A)
      expect(grid.getTileById(4).team).toBe(Team.ENEMY)
      expect(grid.getTileById(5).team).toBe(Team.ENEMY)
    })
  })

  describe('executeSwapCharacters - cross-team swaps without skills', () => {
    it('should swap ally and enemy characters, switching their teams', () => {
      performPlace(grid, 1, ALLY_A, Team.ALLY)
      performPlace(grid, 4, ENEMY_A, Team.ENEMY)

      const result = executeSwapCharacters(grid, skillManager, 1, 4)

      expect(result).toBe(true)
      expect(grid.getTileById(1).characterId).toBe(ENEMY_A)
      expect(grid.getTileById(4).characterId).toBe(ALLY_A)
      expect(grid.getTileById(1).team).toBe(Team.ALLY)
      expect(grid.getTileById(4).team).toBe(Team.ENEMY)
      // Characters switch team membership; tiles keep their occupied states
      expect(isCharacterOnTeam(grid, ENEMY_A, Team.ALLY)).toBe(true)
      expect(isCharacterOnTeam(grid, ALLY_A, Team.ALLY)).toBe(false)
      expect(isCharacterOnTeam(grid, ALLY_A, Team.ENEMY)).toBe(true)
      expect(isCharacterOnTeam(grid, ENEMY_A, Team.ENEMY)).toBe(false)
      expect(grid.getTileById(1).state).toBe(State.OCCUPIED_ALLY)
      expect(grid.getTileById(4).state).toBe(State.OCCUPIED_ENEMY)
    })

    it('should reject swap that would duplicate a character on the destination team', () => {
      // ALLY_A already exists on ENEMY, so swapping its ally copy into ENEMY
      // must be rejected up front with all placements intact
      performPlace(grid, 1, ALLY_A, Team.ALLY)
      performPlace(grid, 4, ENEMY_A, Team.ENEMY)
      performPlace(grid, 5, ALLY_A, Team.ENEMY)

      const result = executeSwapCharacters(grid, skillManager, 1, 4)

      expect(result).toBe(false)
      expect(grid.getTileById(1).characterId).toBe(ALLY_A)
      expect(grid.getTileById(1).team).toBe(Team.ALLY)
      expect(grid.getTileById(4).characterId).toBe(ENEMY_A)
      expect(grid.getTileById(4).team).toBe(Team.ENEMY)
      expect(grid.getTileById(5).characterId).toBe(ALLY_A)
      expect(isCharacterOnTeam(grid, ALLY_A, Team.ALLY)).toBe(true)
      expect(isCharacterOnTeam(grid, ENEMY_A, Team.ENEMY)).toBe(true)
    })
  })

  describe('executeSwapCharacters - cross-team swaps with skills', () => {
    it.each([
      {
        label: 'the from-character',
        phraestoHex: 1,
        phraestoTeam: Team.ALLY,
        otherHex: 4,
        otherId: ENEMY_A,
        otherTeam: Team.ENEMY,
      },
      {
        label: 'the to-character',
        phraestoHex: 4,
        phraestoTeam: Team.ENEMY,
        otherHex: 1,
        otherId: ALLY_A,
        otherTeam: Team.ALLY,
      },
    ])(
      'should relocate the skill when $label has one',
      ({ phraestoHex, phraestoTeam, otherHex, otherId, otherTeam }) => {
        executePlaceCharacter(grid, skillManager, phraestoHex, PHRAESTO, phraestoTeam)
        performPlace(grid, otherHex, otherId, otherTeam)

        const result = executeSwapCharacters(grid, skillManager, 1, 4)

        expect(result).toBe(true)
        expect(skillManager.hasActiveSkill(PHRAESTO, phraestoTeam)).toBe(false)
        expect(skillManager.getActiveSkillInfo(PHRAESTO, otherTeam)).toEqual({
          hexId: otherHex,
          team: otherTeam,
        })
        // The companion follows the skill to the new team
        expect(findCharacterHex(grid, PHRAESTO_COMPANION, phraestoTeam)).toBeNull()
        expect(findCharacterHex(grid, PHRAESTO_COMPANION, otherTeam)).not.toBeNull()
      },
    )

    it('should relocate both skills when both characters have one', () => {
      executePlaceCharacter(grid, skillManager, 1, PHRAESTO, Team.ALLY)
      executePlaceCharacter(grid, skillManager, 4, GUNNAR, Team.ENEMY)

      const result = executeSwapCharacters(grid, skillManager, 1, 4)

      expect(result).toBe(true)
      expect(skillManager.getActiveSkillInfo(PHRAESTO, Team.ENEMY)).toEqual({
        hexId: 4,
        team: Team.ENEMY,
      })
      expect(skillManager.getActiveSkillInfo(GUNNAR, Team.ALLY)).toEqual({
        hexId: 1,
        team: Team.ALLY,
      })
      expect(skillManager.hasActiveSkill(PHRAESTO, Team.ALLY)).toBe(false)
      expect(skillManager.hasActiveSkill(GUNNAR, Team.ENEMY)).toBe(false)
    })

    it('should restore everything when skill activation fails mid-swap', () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => {})
      executePlaceCharacter(grid, skillManager, 1, PHRAESTO, Team.ALLY)
      const companionHex = findCharacterHex(grid, PHRAESTO_COMPANION, Team.ALLY)!
      performPlace(grid, 4, ENEMY_A, Team.ENEMY)
      performPlace(grid, 5, ENEMY_B, Team.ENEMY)

      // No free enemy tile for the companion: reactivation throws, rollback
      const result = executeSwapCharacters(grid, skillManager, 1, 4)

      expect(result).toBe(false)
      expect(grid.getTileById(1).characterId).toBe(PHRAESTO)
      expect(grid.getTileById(1).team).toBe(Team.ALLY)
      expect(grid.getTileById(4).characterId).toBe(ENEMY_A)
      expect(grid.getTileById(4).team).toBe(Team.ENEMY)
      expect(skillManager.getActiveSkillInfo(PHRAESTO, Team.ALLY)).toEqual({
        hexId: 1,
        team: Team.ALLY,
      })
      // Companion restored to its original hex with no duplicates anywhere
      expect(findCharacterHex(grid, PHRAESTO_COMPANION, Team.ALLY)).toBe(companionHex)
      const companionTiles = grid
        .getAllTiles()
        .filter((tile) => tile.characterId === PHRAESTO_COMPANION)
      expect(companionTiles).toHaveLength(1)
      expect(getTilesWithCharacters(grid)).toHaveLength(4)
      error.mockRestore()
    })

    it('should reject a duplicate-creating swap before any skill teardown', () => {
      executePlaceCharacter(grid, skillManager, 1, PHRAESTO, Team.ALLY)
      const companionHex = findCharacterHex(grid, PHRAESTO_COMPANION, Team.ALLY)!
      performPlace(grid, 4, ENEMY_A, Team.ENEMY)
      performPlace(grid, 5, PHRAESTO, Team.ENEMY) // atomic place: no skill activation

      const result = executeSwapCharacters(grid, skillManager, 1, 4)

      expect(result).toBe(false)
      // The guard fires before teardown: skill and companion are untouched
      expect(skillManager.hasActiveSkill(PHRAESTO, Team.ALLY)).toBe(true)
      expect(findCharacterHex(grid, PHRAESTO_COMPANION, Team.ALLY)).toBe(companionHex)
      expect(grid.getTileById(1).characterId).toBe(PHRAESTO)
      expect(grid.getTileById(4).characterId).toBe(ENEMY_A)
    })
  })

  describe('executeSwapCharacters - companion handling', () => {
    it('should prevent companion swap across teams', () => {
      const companionId = grid.companionIdOffset + ALLY_A
      performPlace(grid, 1, companionId, Team.ALLY)
      performPlace(grid, 4, ENEMY_A, Team.ENEMY)

      const result = executeSwapCharacters(grid, skillManager, 1, 4)

      expect(result).toBe(false)
      expect(grid.getTileById(1).characterId).toBe(companionId)
      expect(grid.getTileById(4).characterId).toBe(ENEMY_A)
    })

    it('should prevent swap with companion across teams', () => {
      const companionId = grid.companionIdOffset + ALLY_A
      performPlace(grid, 1, ALLY_A, Team.ALLY)
      performPlace(grid, 4, companionId, Team.ENEMY)

      const result = executeSwapCharacters(grid, skillManager, 1, 4)

      expect(result).toBe(false)
      expect(grid.getTileById(1).characterId).toBe(ALLY_A)
      expect(grid.getTileById(4).characterId).toBe(companionId)
    })

    it('should allow companion swap within same team', () => {
      const companionId = grid.companionIdOffset + ALLY_A
      performPlace(grid, 1, companionId, Team.ALLY)
      performPlace(grid, 2, ALLY_B, Team.ALLY)

      const result = executeSwapCharacters(grid, skillManager, 1, 2)

      expect(result).toBe(true)
      expect(grid.getTileById(1).characterId).toBe(ALLY_B)
      expect(grid.getTileById(2).characterId).toBe(companionId)
    })
  })

  describe('executeSwapCharacters - phantimal handling', () => {
    const phantimalId = toPhantimalId(1)

    it('should reject cross-team swap of a character onto a phantimal', () => {
      performPlace(grid, 1, ALLY_A, Team.ALLY)
      performPlace(grid, 4, phantimalId, Team.ENEMY)

      const result = executeSwapCharacters(grid, skillManager, 1, 4)

      expect(result).toBe(false)
      expect(grid.getTileById(1).characterId).toBe(ALLY_A)
      expect(grid.getTileById(1).team).toBe(Team.ALLY)
      expect(grid.getTileById(4).characterId).toBe(phantimalId)
      expect(grid.getTileById(4).team).toBe(Team.ENEMY)
    })

    it('should reject cross-team swap initiated from a phantimal', () => {
      performPlace(grid, 1, phantimalId, Team.ALLY)
      performPlace(grid, 4, ENEMY_A, Team.ENEMY)

      const result = executeSwapCharacters(grid, skillManager, 1, 4)

      expect(result).toBe(false)
      expect(grid.getTileById(1).characterId).toBe(phantimalId)
      expect(grid.getTileById(4).characterId).toBe(ENEMY_A)
    })

    it('should swap a character and a phantimal on the same team', () => {
      performPlace(grid, 1, ALLY_A, Team.ALLY)
      performPlace(grid, 2, phantimalId, Team.ALLY)

      const result = executeSwapCharacters(grid, skillManager, 1, 2)

      expect(result).toBe(true)
      expect(grid.getTileById(1).characterId).toBe(phantimalId)
      expect(grid.getTileById(2).characterId).toBe(ALLY_A)
      expect(grid.getTileById(1).team).toBe(Team.ALLY)
      expect(grid.getTileById(2).team).toBe(Team.ALLY)
      // Capacity unchanged: the character counts, the phantimal is exempt
      expect(isCharacterOnTeam(grid, ALLY_A, Team.ALLY)).toBe(true)
      expect(getAvailableTeamSize(grid, Team.ALLY)).toBe(4)
    })

    it('should leave a full team fully intact when swapping a character onto its phantimal', () => {
      // Phantimals are tied to their team's faction hero count, so the
      // cross-team guard must reject the swap up front with zero state changes.
      const tGrid = new Grid(TARGETING_GRID, TARGETING_ARENA)
      tGrid.skillManager = skillManager

      performPlace(tGrid, 1, ALLY_A, Team.ALLY)
      const enemyChars = [201, 202, 203, 204, 205]
      enemyChars.forEach((charId, i) => performPlace(tGrid, 9 + i, charId, Team.ENEMY))
      performPlace(tGrid, 14, phantimalId, Team.ENEMY)

      const result = executeSwapCharacters(tGrid, skillManager, 1, 14)

      expect(result).toBe(false)
      expect(tGrid.getTileById(1).characterId).toBe(ALLY_A)
      expect(tGrid.getTileById(1).team).toBe(Team.ALLY)
      expect(tGrid.getTileById(14).characterId).toBe(phantimalId)
      expect(tGrid.getTileById(14).team).toBe(Team.ENEMY)
      expect(isCharacterOnTeam(tGrid, ALLY_A, Team.ALLY)).toBe(true)
      enemyChars.forEach((charId, i) => {
        expect(tGrid.getTileById(9 + i).characterId).toBe(charId)
        expect(isCharacterOnTeam(tGrid, charId, Team.ENEMY)).toBe(true)
      })
      // Phantimals never consume a team slot
      expect(getAvailableTeamSize(tGrid, Team.ALLY)).toBe(4)
      expect(getAvailableTeamSize(tGrid, Team.ENEMY)).toBe(0)
    })
  })
})

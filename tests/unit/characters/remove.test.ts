import { beforeEach, describe, expect, it } from 'vitest'

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
  performRemove,
} from '@/lib/characters/remove'
import { Grid } from '@/lib/grid'
import { SkillManager } from '@/lib/skills/skill'
import { State } from '@/lib/types/state'
import { Team } from '@/lib/types/team'
import { ALLY_A, ENEMY_A, PHRAESTO, PHRAESTO_COMPANION } from '../fixtures/characters'
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
  })

  describe('executeRemoveCharacter', () => {
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
  })

  describe('executeClearAllCharacters', () => {
    it('should deactivate all skills on clear', () => {
      executePlaceCharacter(grid, skillManager, 1, PHRAESTO, Team.ALLY)
      performPlace(grid, 4, ENEMY_A, Team.ENEMY)

      const result = executeClearAllCharacters(grid, skillManager)

      expect(result).toBe(true)
      expect(getTilesWithCharacters(grid)).toHaveLength(0)
      expect(grid.getTileById(1).state).toBe(State.AVAILABLE_ALLY)
      expect(grid.getTileById(4).state).toBe(State.AVAILABLE_ENEMY)
      expect(skillManager.hasActiveSkill(PHRAESTO)).toBe(false)
      expect(getMaxTeamSize(grid, Team.ALLY)).toBe(5)
    })
  })
})

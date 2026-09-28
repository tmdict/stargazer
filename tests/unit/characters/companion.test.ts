import { beforeEach, describe, expect, it } from 'vitest'

import {
  addCompanionLink,
  clearCompanionLinks,
  getCompanions,
  getMainCharacterId,
  isCompanionId,
  restoreCompanions,
  type CompanionPosition,
} from '@/lib/characters/companion'
import { Grid } from '@/lib/grid'
import { SkillManager } from '@/lib/skills/skill'
import { Team } from '@/lib/types/team'
import { COMPANION_ARENA, STANDARD_GRID } from '../fixtures/grid'

describe('companion', () => {
  let grid: Grid
  let skillManager: SkillManager

  beforeEach(() => {
    grid = new Grid(STANDARD_GRID, COMPANION_ARENA)
    skillManager = new SkillManager()
  })

  describe('isCompanionId', () => {
    it('identifies companion IDs correctly', () => {
      expect(isCompanionId(grid, 10000)).toBe(true)
      expect(isCompanionId(grid, 10001)).toBe(true)
      // Upper-bounded by the phantimal namespace so phantimal IDs aren't treated
      // as companions.
      expect(isCompanionId(grid, grid.phantimalIdOffset - 1)).toBe(true)
      expect(isCompanionId(grid, grid.phantimalIdOffset)).toBe(false)
      expect(isCompanionId(grid, grid.phantimalIdOffset + 5)).toBe(false)

      expect(isCompanionId(grid, 100)).toBe(false)
      expect(isCompanionId(grid, 9999)).toBe(false)
      expect(isCompanionId(grid, 1)).toBe(false)
    })
  })

  describe('getMainCharacterId', () => {
    it('extracts main character ID from companion ID', () => {
      expect(getMainCharacterId(grid, 10100)).toBe(100)
      expect(getMainCharacterId(grid, 10001)).toBe(1)
      expect(getMainCharacterId(grid, 12345)).toBe(2345)
      expect(getMainCharacterId(grid, grid.phantimalIdOffset - 1)).toBe(9999)
    })
  })

  describe('companion link management', () => {
    describe('clearCompanionLinks', () => {
      it('only clears companions for specified team', () => {
        addCompanionLink(grid, 100, 10100, Team.ALLY)
        addCompanionLink(grid, 100, 10101, Team.ENEMY)

        clearCompanionLinks(grid, 100, Team.ALLY)

        const allyCompanions = getCompanions(grid, 100, Team.ALLY)
        const enemyCompanions = getCompanions(grid, 100, Team.ENEMY)

        expect(allyCompanions.size).toBe(0)
        expect(enemyCompanions.size).toBe(1)
        expect(enemyCompanions.has(10101)).toBe(true)
      })
    })
  })

  describe('companion position management', () => {
    // The store-and-restore round trip runs for real in move.test.ts's rollback.
    describe('restoreCompanions', () => {
      it('only restores companions for specified main character', () => {
        const companionPositions: CompanionPosition[] = [
          { companionId: 10100, hexId: 2, team: Team.ALLY, mainCharId: 100 },
          { companionId: 10200, hexId: 3, team: Team.ALLY, mainCharId: 200 },
        ]

        // Both companions placed at wrong positions
        const tile4 = grid.getTileById(4)
        tile4.characterId = 10100
        tile4.team = Team.ALLY

        const tile6 = grid.getTileById(6)
        tile6.characterId = 10200
        tile6.team = Team.ALLY

        restoreCompanions(grid, skillManager, 100, companionPositions)

        // 10100 (mainCharId 100) was restored
        expect(grid.getTileById(2).characterId).toBe(10100)
        expect(grid.getTileById(4).characterId).toBeUndefined()
        // 10200 (mainCharId 200) was filtered out — still at its wrong position
        expect(grid.getTileById(6).characterId).toBe(10200)
        expect(grid.getTileById(3).characterId).toBeUndefined()
      })
    })
  })
})

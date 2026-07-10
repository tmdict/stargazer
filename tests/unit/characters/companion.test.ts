import { beforeEach, describe, expect, it } from 'vitest'

import {
  addCompanionLink,
  clearCompanionLinks,
  getCompanions,
  getMainCharacterId,
  isCompanionId,
  removeCompanionLink,
  restoreCompanions,
  storeCompanionPositions,
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

    it('returns same ID for non-companion characters', () => {
      expect(getMainCharacterId(grid, 100)).toBe(100)
      expect(getMainCharacterId(grid, 1)).toBe(1)
      expect(getMainCharacterId(grid, 9999)).toBe(9999)
    })
  })

  describe('companion link management', () => {
    describe('addCompanionLink', () => {
      it('adds multiple companions to same main character', () => {
        addCompanionLink(grid, 100, 10100, Team.ALLY)
        addCompanionLink(grid, 100, 10101, Team.ALLY)
        addCompanionLink(grid, 100, 10102, Team.ALLY)

        const companions = getCompanions(grid, 100, Team.ALLY)
        expect(companions.size).toBe(3)
        expect(companions.has(10100)).toBe(true)
        expect(companions.has(10101)).toBe(true)
        expect(companions.has(10102)).toBe(true)
      })

      it('separates companions by team', () => {
        addCompanionLink(grid, 100, 10100, Team.ALLY)
        addCompanionLink(grid, 100, 10101, Team.ENEMY)

        const allyCompanions = getCompanions(grid, 100, Team.ALLY)
        const enemyCompanions = getCompanions(grid, 100, Team.ENEMY)

        expect(allyCompanions.has(10100)).toBe(true)
        expect(allyCompanions.has(10101)).toBe(false)

        expect(enemyCompanions.has(10100)).toBe(false)
        expect(enemyCompanions.has(10101)).toBe(true)
      })
    })

    describe('removeCompanionLink', () => {
      it('removes specific companion link', () => {
        addCompanionLink(grid, 100, 10100, Team.ALLY)
        addCompanionLink(grid, 100, 10101, Team.ALLY)

        removeCompanionLink(grid, 100, 10100, Team.ALLY)

        const companions = getCompanions(grid, 100, Team.ALLY)
        expect(companions.has(10100)).toBe(false)
        expect(companions.has(10101)).toBe(true)
        expect(companions.size).toBe(1)
      })

      it('removes link entry when last companion removed', () => {
        addCompanionLink(grid, 100, 10100, Team.ALLY)

        removeCompanionLink(grid, 100, 10100, Team.ALLY)

        const key = `100-${Team.ALLY}`
        expect(grid.companionLinks.has(key)).toBe(false)
      })

      it('handles removing non-existent companion', () => {
        addCompanionLink(grid, 100, 10100, Team.ALLY)

        // Should not throw
        expect(() => {
          removeCompanionLink(grid, 100, 10999, Team.ALLY)
        }).not.toThrow()

        // Original companion should still be there
        const companions = getCompanions(grid, 100, Team.ALLY)
        expect(companions.has(10100)).toBe(true)
      })
    })

    describe('clearCompanionLinks', () => {
      it('removes all companions for a main character', () => {
        addCompanionLink(grid, 100, 10100, Team.ALLY)
        addCompanionLink(grid, 100, 10101, Team.ALLY)
        addCompanionLink(grid, 100, 10102, Team.ALLY)

        clearCompanionLinks(grid, 100, Team.ALLY)

        const companions = getCompanions(grid, 100, Team.ALLY)
        expect(companions.size).toBe(0)

        const key = `100-${Team.ALLY}`
        expect(grid.companionLinks.has(key)).toBe(false)
      })

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

    describe('getCompanions', () => {
      it('returns empty set for character with no companions', () => {
        const companions = getCompanions(grid, 999, Team.ALLY)
        expect(companions).toBeInstanceOf(Set)
        expect(companions.size).toBe(0)
      })
    })
  })

  describe('companion position management', () => {
    describe('storeCompanionPositions', () => {
      it('stores positions of placed companions', () => {
        // Place main character
        const tile1 = grid.getTileById(1)
        tile1.characterId = 100
        tile1.team = Team.ALLY

        // Place companions
        const tile2 = grid.getTileById(2)
        tile2.characterId = 10100
        tile2.team = Team.ALLY

        const tile3 = grid.getTileById(3)
        tile3.characterId = 10101
        tile3.team = Team.ALLY

        // Add companion links
        addCompanionLink(grid, 100, 10100, Team.ALLY)
        addCompanionLink(grid, 100, 10101, Team.ALLY)

        const positions = storeCompanionPositions(grid, 100, Team.ALLY)

        expect(positions).toHaveLength(2)
        expect(positions).toContainEqual({
          companionId: 10100,
          hexId: 2,
          team: Team.ALLY,
          mainCharId: 100,
        })
        expect(positions).toContainEqual({
          companionId: 10101,
          hexId: 3,
          team: Team.ALLY,
          mainCharId: 100,
        })
      })

      it('returns empty array for character with no companions', () => {
        const positions = storeCompanionPositions(grid, 999, Team.ALLY)
        expect(positions).toHaveLength(0)
      })

      it('ignores companions not placed on grid', () => {
        // Add companion link but don't place on grid
        addCompanionLink(grid, 100, 10100, Team.ALLY)

        const positions = storeCompanionPositions(grid, 100, Team.ALLY)
        expect(positions).toHaveLength(0)
      })
    })

    describe('restoreCompanions', () => {
      it('restores companions to original positions', () => {
        const companionPositions: CompanionPosition[] = [
          { companionId: 10100, hexId: 2, team: Team.ALLY, mainCharId: 100 },
          { companionId: 10101, hexId: 3, team: Team.ALLY, mainCharId: 100 },
        ]

        // Place companions in wrong positions
        const tile4 = grid.getTileById(4)
        tile4.characterId = 10100
        tile4.team = Team.ALLY

        const tile5 = grid.getTileById(5)
        tile5.characterId = 10101
        tile5.team = Team.ALLY

        restoreCompanions(grid, skillManager, 100, companionPositions)

        // Companions are now at their stored positions
        expect(grid.getTileById(2).characterId).toBe(10100)
        expect(grid.getTileById(3).characterId).toBe(10101)
        // And cleared from the wrong positions
        expect(grid.getTileById(4).characterId).toBeUndefined()
        expect(grid.getTileById(5).characterId).toBeUndefined()
      })

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

      it('handles companions already in correct position', () => {
        const companionPositions: CompanionPosition[] = [
          {
            companionId: 10100,
            hexId: 2,
            team: Team.ALLY,
            mainCharId: 100,
          },
        ]

        // Place companion in correct position
        const tile2 = grid.getTileById(2)
        tile2.characterId = 10100
        tile2.team = Team.ALLY

        restoreCompanions(grid, skillManager, 100, companionPositions)

        // Companion ends at its original tile
        expect(tile2.characterId).toBe(10100)
      })
    })
  })

  describe('edge cases', () => {
    it('handles multiple main characters with companions', () => {
      addCompanionLink(grid, 100, 10100, Team.ALLY)
      addCompanionLink(grid, 100, 10101, Team.ALLY)
      addCompanionLink(grid, 200, 10200, Team.ALLY)
      addCompanionLink(grid, 200, 10201, Team.ALLY)

      const companions100 = getCompanions(grid, 100, Team.ALLY)
      const companions200 = getCompanions(grid, 200, Team.ALLY)

      expect(companions100.size).toBe(2)
      expect(companions200.size).toBe(2)

      // No overlap
      expect(companions100.has(10200)).toBe(false)
      expect(companions200.has(10100)).toBe(false)
    })
  })
})

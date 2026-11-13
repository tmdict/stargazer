import { beforeEach, describe, expect, it } from 'vitest'

import { isCompanionId } from '@/lib/characters/character'
import { restoreCompanions, type CompanionPosition } from '@/lib/characters/companion'
import { PHANTIMAL_ID_OFFSET } from '@/lib/characters/unitIds'
import { Grid } from '@/lib/grid'
import { SkillManager } from '@/lib/skills/skill'
import { Team } from '@/lib/types/team'
import { COMPANION_ARENA, STANDARD_GRID } from '../fixtures/grid'
import { NO_LOOKUPS } from '../fixtures/skills'

describe('companion', () => {
  let grid: Grid
  let skillManager: SkillManager

  beforeEach(() => {
    grid = new Grid(STANDARD_GRID, COMPANION_ARENA)
    skillManager = new SkillManager(NO_LOOKUPS)
  })

  describe('isCompanionId', () => {
    it('identifies companion IDs correctly', () => {
      expect(isCompanionId(10000)).toBe(true)
      expect(isCompanionId(10001)).toBe(true)
      // A phantimal reads on its band-local id, below the companion range.
      expect(isCompanionId(PHANTIMAL_ID_OFFSET - 1)).toBe(true)
      expect(isCompanionId(PHANTIMAL_ID_OFFSET)).toBe(false)
      expect(isCompanionId(PHANTIMAL_ID_OFFSET + 5)).toBe(false)

      expect(isCompanionId(100)).toBe(false)
      expect(isCompanionId(9999)).toBe(false)
      expect(isCompanionId(1)).toBe(false)
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

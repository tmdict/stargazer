import { beforeEach, describe, expect, it } from 'vitest'

import { Grid } from '@/lib/grid'
import type { SkillContext } from '@/lib/skills/skill'
import { SkillManager } from '@/lib/skills/skill'
import { rowScan, RowScanDirection, spiralSearchFromTile } from '@/lib/skills/utils/ring'
import type { GridPreset } from '@/lib/types/grid'
import { State } from '@/lib/types/state'
import { Team } from '@/lib/types/team'

const TEST_GRID: GridPreset = {
  hex: [[7], [6, 8], [5, 9], [4, 10], [3, 11], [2, 12], [1, 13, 14]],
  qOffset: [0, -1, -1, -2, -2, -3, -3],
}

const TEST_ARENA = {
  id: 1,
  name: 'Test',
  grid: [
    { type: State.AVAILABLE_ALLY, hex: [1, 2, 3, 4, 5, 6] },
    { type: State.AVAILABLE_ENEMY, hex: [9, 10, 11, 12, 13, 14] },
    { type: State.DEFAULT, hex: [7, 8] },
  ],
}

describe('ring targeting', () => {
  let grid: Grid

  beforeEach(() => {
    grid = new Grid(TEST_GRID, TEST_ARENA)
  })

  describe('spiralSearchFromTile', () => {
    beforeEach(() => {
      const tile3 = grid.getTileById(3)
      tile3.characterId = 100
      tile3.team = Team.ALLY

      const tile11 = grid.getTileById(11)
      tile11.characterId = 200
      tile11.team = Team.ENEMY
    })

    it('finds nearest target via spiral search', () => {
      const result = spiralSearchFromTile(grid, 7, Team.ALLY, Team.ENEMY)

      expect(result).not.toBeNull()
      expect(result?.targetCharacterId).toBe(100)
      expect(result?.metadata?.symmetricalHexId).toBe(7)
      expect(result?.metadata?.isSymmetricalTarget).toBe(false)
    })

    it('returns null when no targets exist', () => {
      grid.getTileById(3).characterId = undefined

      const result = spiralSearchFromTile(grid, 7, Team.ALLY, Team.ENEMY)
      expect(result).toBeNull()
    })

    it('handles invalid center hex', () => {
      expect(() => spiralSearchFromTile(grid, 999, Team.ALLY, Team.ENEMY)).toThrow(
        'Hex with ID 999 not found',
      )
    })

    it('examines tiles in spiral pattern', () => {
      const tile5 = grid.getTileById(5)
      tile5.characterId = 101
      tile5.team = Team.ALLY

      const result = spiralSearchFromTile(grid, 7, Team.ALLY, Team.ENEMY)

      expect(result).not.toBeNull()
      expect(result?.metadata?.examinedTiles).toBeDefined()
      expect(result?.metadata?.examinedTiles!.length).toBeGreaterThan(0)
    })

    it('uses correct walk order for ally team', () => {
      const tile6 = grid.getTileById(6)
      tile6.characterId = 101
      tile6.team = Team.ALLY

      const tile8 = grid.getTileById(8)
      tile8.characterId = 102
      tile8.team = Team.ALLY

      const result = spiralSearchFromTile(grid, 7, Team.ALLY, Team.ALLY)

      expect(result).not.toBeNull()
      expect([6, 8]).toContain(result?.targetHexId)
    })
  })

  describe('rowScan with RowScanDirection', () => {
    it('FRONTMOST: ally scans highest hex ID first within each ring', () => {
      // Place two allies at same distance from hex 7
      const tile6 = grid.getTileById(6)
      tile6.characterId = 101
      tile6.team = Team.ALLY

      const tile8 = grid.getTileById(8)
      tile8.characterId = 102
      tile8.team = Team.ALLY

      const context: SkillContext = {
        grid,
        hexId: 7,
        team: Team.ALLY,
        characterId: 300,
        skillManager: {} as SkillManager,
      }

      const result = rowScan(context, Team.ALLY, { direction: RowScanDirection.FRONTMOST })

      expect(result).not.toBeNull()
      // FRONTMOST for ally: highest hex ID first → hex 8 before hex 6
      expect(result?.targetHexId).toBe(8)
    })

    it('REARMOST: ally scans lowest hex ID first within each ring', () => {
      // Place two allies at same distance from hex 7
      const tile6 = grid.getTileById(6)
      tile6.characterId = 101
      tile6.team = Team.ALLY

      const tile8 = grid.getTileById(8)
      tile8.characterId = 102
      tile8.team = Team.ALLY

      const context: SkillContext = {
        grid,
        hexId: 7,
        team: Team.ALLY,
        characterId: 300,
        skillManager: {} as SkillManager,
      }

      const result = rowScan(context, Team.ALLY, { direction: RowScanDirection.REARMOST })

      expect(result).not.toBeNull()
      // REARMOST for ally: lowest hex ID first → hex 6 before hex 8
      expect(result?.targetHexId).toBe(6)
    })

    it('REARMOST: enemy scans highest hex ID first within each ring', () => {
      const tile11 = grid.getTileById(11)
      tile11.characterId = 201
      tile11.team = Team.ENEMY

      const tile13 = grid.getTileById(13)
      tile13.characterId = 202
      tile13.team = Team.ENEMY

      const context: SkillContext = {
        grid,
        hexId: 12,
        team: Team.ENEMY,
        characterId: 300,
        skillManager: {} as SkillManager,
      }

      const result = rowScan(context, Team.ENEMY, { direction: RowScanDirection.REARMOST })

      expect(result).not.toBeNull()
      // REARMOST for enemy: highest hex ID first → hex 13 before hex 11
      expect(result?.targetHexId).toBe(13)
    })

    it('FRONTMOST: enemy scans lowest hex ID first within each ring', () => {
      const tile11 = grid.getTileById(11)
      tile11.characterId = 201
      tile11.team = Team.ENEMY

      const tile13 = grid.getTileById(13)
      tile13.characterId = 202
      tile13.team = Team.ENEMY

      const context: SkillContext = {
        grid,
        hexId: 12,
        team: Team.ENEMY,
        characterId: 300,
        skillManager: {} as SkillManager,
      }

      const result = rowScan(context, Team.ENEMY, { direction: RowScanDirection.FRONTMOST })

      expect(result).not.toBeNull()
      // FRONTMOST for enemy: lowest hex ID first → hex 11 before hex 13
      expect(result?.targetHexId).toBe(11)
    })

    it('defaults to FRONTMOST when no direction specified', () => {
      const tile6 = grid.getTileById(6)
      tile6.characterId = 101
      tile6.team = Team.ALLY

      const tile8 = grid.getTileById(8)
      tile8.characterId = 102
      tile8.team = Team.ALLY

      const context: SkillContext = {
        grid,
        hexId: 7,
        team: Team.ALLY,
        characterId: 300,
        skillManager: {} as SkillManager,
      }

      const defaultResult = rowScan(context, Team.ALLY)
      const explicitResult = rowScan(context, Team.ALLY, { direction: RowScanDirection.FRONTMOST })

      expect(defaultResult?.targetHexId).toBe(explicitResult?.targetHexId)
    })

    it('returns null when no candidates exist', () => {
      const context: SkillContext = {
        grid,
        hexId: 7,
        team: Team.ALLY,
        characterId: 300,
        skillManager: {} as SkillManager,
      }

      const result = rowScan(context, Team.ALLY, { direction: RowScanDirection.REARMOST })
      expect(result).toBeNull()
    })

    it('excludes self from candidates', () => {
      // Only place self — should return null
      const tile6 = grid.getTileById(6)
      tile6.characterId = 300
      tile6.team = Team.ALLY

      const context: SkillContext = {
        grid,
        hexId: 7,
        team: Team.ALLY,
        characterId: 300,
        skillManager: {} as SkillManager,
      }

      const result = rowScan(context, Team.ALLY, { direction: RowScanDirection.REARMOST })
      expect(result).toBeNull()
    })

    it('finds target in outer ring when inner ring is empty', () => {
      // Place ally only at distance 2 from hex 7
      const tile5 = grid.getTileById(5)
      tile5.characterId = 101
      tile5.team = Team.ALLY

      const context: SkillContext = {
        grid,
        hexId: 7,
        team: Team.ALLY,
        characterId: 300,
        skillManager: {} as SkillManager,
      }

      const result = rowScan(context, Team.ALLY, { direction: RowScanDirection.REARMOST })

      expect(result).not.toBeNull()
      expect(result?.targetHexId).toBe(5)
      expect(result?.metadata?.distance).toBe(2)
    })

    it('maxDistance limits scan to specified ring', () => {
      // Place ally at distance 1 and distance 2
      const tile6 = grid.getTileById(6)
      tile6.characterId = 101
      tile6.team = Team.ALLY

      const tile5 = grid.getTileById(5)
      tile5.characterId = 102
      tile5.team = Team.ALLY

      const context: SkillContext = {
        grid,
        hexId: 7,
        team: Team.ALLY,
        characterId: 300,
        skillManager: {} as SkillManager,
      }

      // With maxDistance 1, should only find hex 6 (distance 1), not hex 5 (distance 2)
      const result = rowScan(context, Team.ALLY, {
        direction: RowScanDirection.REARMOST,
        maxDistance: 1,
      })

      expect(result).not.toBeNull()
      expect(result?.targetHexId).toBe(6)
      expect(result?.metadata?.distance).toBe(1)
    })

    it('maxDistance returns null when no candidates within range', () => {
      // Place ally only at distance 2
      const tile5 = grid.getTileById(5)
      tile5.characterId = 101
      tile5.team = Team.ALLY

      const context: SkillContext = {
        grid,
        hexId: 7,
        team: Team.ALLY,
        characterId: 300,
        skillManager: {} as SkillManager,
      }

      const result = rowScan(context, Team.ALLY, {
        direction: RowScanDirection.REARMOST,
        maxDistance: 1,
      })

      expect(result).toBeNull()
    })

    it('excludeCompanions filters out companion characters', () => {
      // Place a regular ally and a companion (ID >= 10000)
      const tile6 = grid.getTileById(6)
      tile6.characterId = 10050 // Companion ID
      tile6.team = Team.ALLY

      const tile8 = grid.getTileById(8)
      tile8.characterId = 101 // Regular character
      tile8.team = Team.ALLY

      const context: SkillContext = {
        grid,
        hexId: 7,
        team: Team.ALLY,
        characterId: 300,
        skillManager: {} as SkillManager,
      }

      // Without excludeCompanions, REARMOST picks lowest hex ID (6 = companion)
      const withCompanions = rowScan(context, Team.ALLY, {
        direction: RowScanDirection.REARMOST,
      })
      expect(withCompanions?.targetHexId).toBe(6)

      // With excludeCompanions, companion is skipped, picks hex 8
      const withoutCompanions = rowScan(context, Team.ALLY, {
        direction: RowScanDirection.REARMOST,
        excludeCompanions: true,
      })
      expect(withoutCompanions?.targetHexId).toBe(8)
    })

    it('excludeCompanions returns null when only companions exist', () => {
      const tile6 = grid.getTileById(6)
      tile6.characterId = 10050
      tile6.team = Team.ALLY

      const context: SkillContext = {
        grid,
        hexId: 7,
        team: Team.ALLY,
        characterId: 300,
        skillManager: {} as SkillManager,
      }

      const result = rowScan(context, Team.ALLY, {
        direction: RowScanDirection.REARMOST,
        excludeCompanions: true,
      })
      expect(result).toBeNull()
    })
  })
})

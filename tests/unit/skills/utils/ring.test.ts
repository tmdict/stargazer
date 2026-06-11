import { beforeEach, describe, expect, it } from 'vitest'

import { Grid } from '@/lib/grid'
import { rowScan, RowScanDirection, spiralSearchFromTile } from '@/lib/skills/utils/ring'
import { Team } from '@/lib/types/team'
import { TARGETING_ARENA, TARGETING_GRID } from '../../fixtures/grid'
import { makeSkillContext, placeOnTile } from '../../fixtures/skills'

describe('ring targeting', () => {
  let grid: Grid

  beforeEach(() => {
    grid = new Grid(TARGETING_GRID, TARGETING_ARENA)
  })

  describe('spiralSearchFromTile', () => {
    beforeEach(() => {
      placeOnTile(grid, 3, 100, Team.ALLY)
      placeOnTile(grid, 11, 200, Team.ENEMY)
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

    it('expands ring by ring, examining each full ring before the next', () => {
      placeOnTile(grid, 5, 101, Team.ALLY)

      const result = spiralSearchFromTile(grid, 7, Team.ALLY, Team.ENEMY)

      // Ring 1 around hex 7 is [8, 6] in enemy walk order; the hit at hex 5
      // (distance 2) is only reached after the whole inner ring is examined
      expect(result?.targetHexId).toBe(5)
      expect(result?.metadata?.examinedTiles).toEqual([8, 6, 5])
    })

    it('walks clockwise for ally casters and counter-clockwise for enemy casters', () => {
      // Hexes 8 and 10 are both adjacent to hex 9 but sit at angles that the
      // two walk directions visit in opposite order
      placeOnTile(grid, 8, 101, Team.ALLY)
      placeOnTile(grid, 10, 102, Team.ALLY)

      expect(spiralSearchFromTile(grid, 9, Team.ALLY, Team.ALLY)?.targetHexId).toBe(10)
      expect(spiralSearchFromTile(grid, 9, Team.ALLY, Team.ENEMY)?.targetHexId).toBe(8)
    })
  })

  describe('rowScan with RowScanDirection', () => {
    it('FRONTMOST: ally scans highest hex ID first within each ring', () => {
      placeOnTile(grid, 6, 101, Team.ALLY)
      placeOnTile(grid, 8, 102, Team.ALLY)
      const context = makeSkillContext(grid, 7, Team.ALLY, 300)

      const result = rowScan(context, Team.ALLY, { direction: RowScanDirection.FRONTMOST })

      expect(result?.targetHexId).toBe(8)
    })

    it('REARMOST: ally scans lowest hex ID first within each ring', () => {
      placeOnTile(grid, 6, 101, Team.ALLY)
      placeOnTile(grid, 8, 102, Team.ALLY)
      const context = makeSkillContext(grid, 7, Team.ALLY, 300)

      const result = rowScan(context, Team.ALLY, { direction: RowScanDirection.REARMOST })

      expect(result?.targetHexId).toBe(6)
    })

    it('REARMOST: enemy scans highest hex ID first within each ring', () => {
      placeOnTile(grid, 11, 201, Team.ENEMY)
      placeOnTile(grid, 13, 202, Team.ENEMY)
      const context = makeSkillContext(grid, 12, Team.ENEMY, 300)

      const result = rowScan(context, Team.ENEMY, { direction: RowScanDirection.REARMOST })

      expect(result?.targetHexId).toBe(13)
    })

    it('FRONTMOST: enemy scans lowest hex ID first within each ring', () => {
      placeOnTile(grid, 11, 201, Team.ENEMY)
      placeOnTile(grid, 13, 202, Team.ENEMY)
      const context = makeSkillContext(grid, 12, Team.ENEMY, 300)

      const result = rowScan(context, Team.ENEMY, { direction: RowScanDirection.FRONTMOST })

      expect(result?.targetHexId).toBe(11)
    })

    it('defaults to FRONTMOST when no direction specified', () => {
      placeOnTile(grid, 6, 101, Team.ALLY)
      placeOnTile(grid, 8, 102, Team.ALLY)
      const context = makeSkillContext(grid, 7, Team.ALLY, 300)

      const defaultResult = rowScan(context, Team.ALLY)
      const explicitResult = rowScan(context, Team.ALLY, { direction: RowScanDirection.FRONTMOST })

      expect(defaultResult?.targetHexId).toBe(explicitResult?.targetHexId)
    })

    it('returns null when no candidates exist', () => {
      const context = makeSkillContext(grid, 7, Team.ALLY, 300)

      const result = rowScan(context, Team.ALLY, { direction: RowScanDirection.REARMOST })
      expect(result).toBeNull()
    })

    it('excludes self from candidates', () => {
      // Only self is placed, so nothing remains to target
      placeOnTile(grid, 6, 300, Team.ALLY)
      const context = makeSkillContext(grid, 7, Team.ALLY, 300)

      const result = rowScan(context, Team.ALLY, { direction: RowScanDirection.REARMOST })
      expect(result).toBeNull()
    })

    it('finds target in outer ring when inner ring is empty', () => {
      placeOnTile(grid, 5, 101, Team.ALLY)
      const context = makeSkillContext(grid, 7, Team.ALLY, 300)

      const result = rowScan(context, Team.ALLY, { direction: RowScanDirection.REARMOST })

      expect(result?.targetHexId).toBe(5)
      expect(result?.metadata?.distance).toBe(2)
    })

    it('maxDistance limits scan to specified ring', () => {
      placeOnTile(grid, 6, 101, Team.ALLY)
      placeOnTile(grid, 5, 102, Team.ALLY)
      const context = makeSkillContext(grid, 7, Team.ALLY, 300)

      const result = rowScan(context, Team.ALLY, {
        direction: RowScanDirection.REARMOST,
        maxDistance: 1,
      })

      expect(result?.targetHexId).toBe(6)
      expect(result?.metadata?.distance).toBe(1)
    })

    it('maxDistance returns null when no candidates within range', () => {
      placeOnTile(grid, 5, 101, Team.ALLY)
      const context = makeSkillContext(grid, 7, Team.ALLY, 300)

      const result = rowScan(context, Team.ALLY, {
        direction: RowScanDirection.REARMOST,
        maxDistance: 1,
      })

      expect(result).toBeNull()
    })

    it('excludeCompanions filters out companion characters', () => {
      placeOnTile(grid, 6, 10050, Team.ALLY) // companion ID
      placeOnTile(grid, 8, 101, Team.ALLY)
      const context = makeSkillContext(grid, 7, Team.ALLY, 300)

      // Without excludeCompanions, REARMOST picks lowest hex ID (6 = companion)
      const withCompanions = rowScan(context, Team.ALLY, {
        direction: RowScanDirection.REARMOST,
      })
      expect(withCompanions?.targetHexId).toBe(6)

      const withoutCompanions = rowScan(context, Team.ALLY, {
        direction: RowScanDirection.REARMOST,
        excludeCompanions: true,
      })
      expect(withoutCompanions?.targetHexId).toBe(8)
    })

    it('excludeCompanions returns null when only companions exist', () => {
      placeOnTile(grid, 6, 10050, Team.ALLY)
      const context = makeSkillContext(grid, 7, Team.ALLY, 300)

      const result = rowScan(context, Team.ALLY, {
        direction: RowScanDirection.REARMOST,
        excludeCompanions: true,
      })
      expect(result).toBeNull()
    })
  })
})

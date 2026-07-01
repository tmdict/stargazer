import { beforeEach, describe, expect, it } from 'vitest'

import { Grid } from '@/lib/grid'
import { rowScan, ScanDirection, spiralSearchFromTile } from '@/lib/skills/utils/ring'
import { Team } from '@/lib/types/team'
import { TARGETING_ARENA, TARGETING_GRID } from '../../fixtures/grid'
import { makeSkillContext, placeOnTile } from '../../fixtures/skills'

describe('spiralSearchFromTile', () => {
  let grid: Grid

  beforeEach(() => {
    grid = new Grid(TARGETING_GRID, TARGETING_ARENA)
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

describe('rowScan (diagonal-row scan)', () => {
  // Caster on tile 9 of the real arena. Its six neighbours span diagonal rows
  // (q - r): -6 {4}, -5 {6,7}, -3 {12,13}, -2 {16}. For an ally, REARMOST rows run
  // back-to-front (ascending diagonal); tile 1 sits one ring further out (dist 2).
  let grid: Grid
  const ally = () => makeSkillContext(grid, 9, Team.ALLY, 300)
  const enemy = () => makeSkillContext(grid, 9, Team.ENEMY, 300)

  const REAR = ScanDirection.REARMOST
  const FRONT = ScanDirection.FRONTMOST

  beforeEach(() => {
    grid = new Grid()
  })

  it('within a row, REARMOST takes the lower hex id and FRONTMOST the higher', () => {
    placeOnTile(grid, 6, 101, Team.ALLY)
    placeOnTile(grid, 7, 102, Team.ALLY)

    expect(
      rowScan(ally(), { team: Team.ALLY, rowDirection: REAR, withinRowDirection: REAR })
        ?.targetHexId,
    ).toBe(6)
    expect(
      rowScan(ally(), { team: Team.ALLY, rowDirection: REAR, withinRowDirection: FRONT })
        ?.targetHexId,
    ).toBe(7)
  })

  it('withinRowDirection defaults to rowDirection when omitted', () => {
    placeOnTile(grid, 6, 101, Team.ALLY)
    placeOnTile(grid, 7, 102, Team.ALLY)

    // Omitting it matches REARMOST within, so the lower hex id wins as in the explicit case.
    expect(rowScan(ally(), { team: Team.ALLY, rowDirection: REAR })?.targetHexId).toBe(6)
  })

  it('rowDirection chooses which diagonal row is reached first', () => {
    placeOnTile(grid, 4, 101, Team.ALLY) // diagonal row -6 (rear)
    placeOnTile(grid, 16, 102, Team.ALLY) // diagonal row -2 (front)

    expect(
      rowScan(ally(), { team: Team.ALLY, rowDirection: REAR, withinRowDirection: FRONT })
        ?.targetHexId,
    ).toBe(4)
    expect(
      rowScan(ally(), { team: Team.ALLY, rowDirection: FRONT, withinRowDirection: FRONT })
        ?.targetHexId,
    ).toBe(16)
  })

  it('mirrors the within-row order for an enemy caster', () => {
    placeOnTile(grid, 6, 201, Team.ENEMY)
    placeOnTile(grid, 7, 202, Team.ENEMY)

    expect(
      rowScan(enemy(), { team: Team.ENEMY, rowDirection: REAR, withinRowDirection: REAR })
        ?.targetHexId,
    ).toBe(7)
    expect(
      rowScan(enemy(), { team: Team.ENEMY, rowDirection: REAR, withinRowDirection: FRONT })
        ?.targetHexId,
    ).toBe(6)
  })

  it('mirrors the diagonal-row order for an enemy caster', () => {
    // Different diagonals (unlike 6/7 above), so this pins the row-axis flip:
    // an enemy's rear is the high-diagonal end an ally calls its front.
    placeOnTile(grid, 4, 201, Team.ENEMY) // diagonal row -6: an enemy's front
    placeOnTile(grid, 16, 202, Team.ENEMY) // diagonal row -2: an enemy's rear

    expect(
      rowScan(enemy(), { team: Team.ENEMY, rowDirection: REAR, withinRowDirection: REAR })
        ?.targetHexId,
    ).toBe(16)
    expect(
      rowScan(enemy(), { team: Team.ENEMY, rowDirection: FRONT, withinRowDirection: FRONT })
        ?.targetHexId,
    ).toBe(4)
  })

  it('expands to the next ring when the nearest is empty', () => {
    placeOnTile(grid, 1, 101, Team.ALLY) // distance 2

    const result = rowScan(ally(), {
      team: Team.ALLY,
      rowDirection: REAR,
      withinRowDirection: REAR,
    })
    expect(result?.targetHexId).toBe(1)
    expect(result?.metadata?.distance).toBe(2)
  })

  it('maxDistance bounds the scan to the nearest ring', () => {
    placeOnTile(grid, 1, 101, Team.ALLY) // distance 2
    placeOnTile(grid, 4, 102, Team.ALLY) // distance 1

    const result = rowScan(ally(), {
      team: Team.ALLY,
      rowDirection: REAR,
      withinRowDirection: REAR,
      maxDistance: 1,
    })
    expect(result?.targetHexId).toBe(4)
    expect(result?.metadata?.distance).toBe(1)
  })

  it('returns null when no candidate is within maxDistance', () => {
    placeOnTile(grid, 1, 101, Team.ALLY) // distance 2

    const result = rowScan(ally(), {
      team: Team.ALLY,
      rowDirection: REAR,
      withinRowDirection: REAR,
      maxDistance: 1,
    })
    expect(result).toBeNull()
  })

  it('returns null when there are no candidates', () => {
    expect(
      rowScan(ally(), { team: Team.ALLY, rowDirection: REAR, withinRowDirection: REAR }),
    ).toBeNull()
  })

  it('excludes the caster itself', () => {
    placeOnTile(grid, 4, 300, Team.ALLY) // same id as the caster

    expect(
      rowScan(ally(), { team: Team.ALLY, rowDirection: REAR, withinRowDirection: REAR }),
    ).toBeNull()
  })

  it('filter keeps only matching candidates', () => {
    placeOnTile(grid, 4, 101, Team.ALLY) // rear row, would win without the filter
    placeOnTile(grid, 7, 102, Team.ALLY)

    const result = rowScan(ally(), {
      team: Team.ALLY,
      rowDirection: REAR,
      withinRowDirection: REAR,
      filter: (id) => id === 102,
    })
    expect(result?.targetHexId).toBe(7)
  })
})

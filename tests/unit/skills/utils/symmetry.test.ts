import { describe, expect, it } from 'vitest'

import { Grid } from '@/lib/grid'
import { getSymmetricalHexId } from '@/lib/skills/utils/symmetry'

/**
 * Oracle: the original hand-derived diagonal-row table for FULL_GRID (visually
 * verified against the rendered board, predating the coordinate derivation).
 * The runtime now computes both relations from cube coordinates — same
 * diagonal ⇔ equal q − r, mirror ⇔ q↔r swap — and these tests pin that the
 * derivation reproduces the human-verified table exactly.
 */
const DIAGONAL_ROWS: readonly number[][] = [
  [1, 2],
  [3, 4, 5],
  [6, 7],
  [8, 9, 10],
  [11, 12, 13, 14],
  [15, 16, 17],
  [18, 19, 20, 21],
  [22, 23, 24], // middle diagonal
  [25, 26, 27, 28],
  [29, 30, 31],
  [32, 33, 34, 35],
  [36, 37, 38],
  [39, 40],
  [41, 42, 43],
  [44, 45],
]

const MIDDLE_ROW = 7

// The original symmetry construction: mirror row i ↔ row 14 − i, pairing by
// position (first→first); the middle diagonal maps to itself.
function buildOracleSymmetryMap(): Map<number, number> {
  const map = new Map<number, number>()
  for (let row = 0; row < DIAGONAL_ROWS.length; row++) {
    const targetRow = 2 * MIDDLE_ROW - row
    if (targetRow < 0 || targetRow >= DIAGONAL_ROWS.length) continue
    const source = DIAGONAL_ROWS[row]!
    const target = DIAGONAL_ROWS[targetRow]!
    for (let pos = 0; pos < Math.min(source.length, target.length); pos++) {
      map.set(source[pos]!, target[pos]!)
      map.set(target[pos]!, source[pos]!)
    }
  }
  for (const hexId of DIAGONAL_ROWS[MIDDLE_ROW]!) map.set(hexId, hexId)
  return map
}

describe('diagonal geometry vs the hand-derived FULL_GRID table', () => {
  const grid = new Grid()
  const hexOf = (id: number) => grid.getHexById(id)

  it('q − r partitions the 45 tiles exactly into the table rows', () => {
    for (const row of DIAGONAL_ROWS) {
      const diagonal = hexOf(row[0]!).getDiagonal()
      const members = grid
        .getAllTiles()
        .filter((t) => t.hex.getDiagonal() === diagonal)
        .map((t) => t.hex.getId())
        .sort((a, b) => a - b)
      expect(members).toEqual([...row].sort((a, b) => a - b))
    }
  })

  it('the middle diagonal is q = r (diagonal 0)', () => {
    for (const hexId of DIAGONAL_ROWS[MIDDLE_ROW]!) {
      expect(hexOf(hexId).getDiagonal()).toBe(0)
    }
  })

  it('getSymmetricalHexId reproduces the original table-built mirror map for all 45 hexes', () => {
    const oracle = buildOracleSymmetryMap()
    for (const tile of grid.getAllTiles()) {
      const id = tile.hex.getId()
      expect(getSymmetricalHexId(grid, id), `hex ${id}`).toBe(oracle.get(id))
    }
  })

  it('mirroring is bidirectional and fixes the middle diagonal', () => {
    for (const tile of grid.getAllTiles()) {
      const id = tile.hex.getId()
      const mirror = getSymmetricalHexId(grid, id)
      expect(mirror).toBeDefined()
      expect(getSymmetricalHexId(grid, mirror!)).toBe(id)
    }
    expect(getSymmetricalHexId(grid, 23)).toBe(23)
  })
})

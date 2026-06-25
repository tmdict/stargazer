import { describe, expect, it } from 'vitest'

import { Grid } from '@/lib/grid'
import { clipLaneBoundary, hexesBetween } from '@/lib/skills/utils/line'

describe('hexesBetween', () => {
  const grid = new Grid()
  // The returned hexes are id-less (coordinate-only); map them back to grid cell
  // ids for readable assertions.
  const betweenIds = (a: number, b: number): Array<number | undefined> =>
    hexesBetween(grid.getHexById(a), grid.getHexById(b)).map((hex) =>
      grid.getTileOrUndefined(hex)?.hex.getId(),
    )

  it('returns the cells on a straight axis between two collinear cells', () => {
    // Cells 1, 4, 7, 10 share q = -3 (one straight column).
    expect(betweenIds(1, 10)).toEqual([4, 7])
  })

  it('is order-independent', () => {
    expect(betweenIds(10, 1)).toEqual([7, 4])
  })

  it('returns [] for adjacent cells (nothing between)', () => {
    expect(betweenIds(1, 4)).toEqual([])
  })

  it('returns [] for the same cell', () => {
    expect(betweenIds(1, 1)).toEqual([])
  })

  it('returns [] when the two cells share no axis', () => {
    // Cells 1 (q -3, r 4) and 45 (q 3, r -4) share no coordinate.
    expect(betweenIds(1, 45)).toEqual([])
  })
})

describe('clipLaneBoundary', () => {
  const grid = new Grid()
  const hexes = (ids: number[]) => ids.map((id) => grid.getHexById(id))

  it('spans the full lane across the whole grid', () => {
    // The s=2 lane runs cells 5..43 (its corner-3 edge).
    expect(clipLaneBoundary(grid.keys(), 2, 3)).toEqual({
      fromHexId: 5,
      fromCorner: 3,
      toHexId: 43,
      toCorner: 3,
    })
  })

  it('extends across the adjacent lane to the visible edge', () => {
    // Team view shows only s=2 cells 5,10 and the s=3 cells 14,21 just outside the band.
    // The edge must reach cell 21 (corner 5), not stub out at cell 10.
    expect(clipLaneBoundary(hexes([5, 10, 14, 21]), 2, 3)).toEqual({
      fromHexId: 5,
      fromCorner: 3,
      toHexId: 21,
      toCorner: 5,
    })
  })

  it('reaches the adjacent lane on the -s side too', () => {
    // s=-2 cells 3,8 plus s=-3 cells 11,18: the low edge reaches cell 18 (corner 2).
    expect(clipLaneBoundary(hexes([3, 8, 11, 18]), -2, 0)).toEqual({
      fromHexId: 3,
      fromCorner: 0,
      toHexId: 18,
      toCorner: 2,
    })
  })

  it('returns null when a single cell leaves no span', () => {
    expect(clipLaneBoundary(hexes([10]), 2, 3)).toBeNull()
  })
})

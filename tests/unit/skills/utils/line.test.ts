import { describe, expect, it } from 'vitest'

import { Grid } from '@/lib/grid'
import { hexesBetween } from '@/lib/skills/utils/line'

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

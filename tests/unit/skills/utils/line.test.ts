import { describe, expect, it } from 'vitest'

import { Grid } from '@/lib/grid'
import { clipLaneBoundary, zoneOutline } from '@/lib/skills/utils/line'

describe('zoneOutline', () => {
  it('outlines a single hex with all six edges, corners clockwise per direction', () => {
    const lines = zoneOutline([new Grid().getHexById(23)], 'red')
    expect(lines.map((line) => [line.fromCorner, line.toCorner])).toEqual([
      [4, 5],
      [5, 0],
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
    ])
  })
})

describe('clipLaneBoundary', () => {
  const grid = new Grid()
  const hexes = (ids: number[]) => ids.map((id) => grid.getHexById(id))

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
})

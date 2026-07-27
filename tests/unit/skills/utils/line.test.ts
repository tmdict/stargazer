import { describe, expect, it } from 'vitest'

import { Grid } from '@/lib/grid'
import { clipLaneBoundary, hexesBetween, outlineEdges } from '@/lib/skills/utils/line'

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

describe('outlineEdges', () => {
  const grid = new Grid()
  const hexes = (ids: number[]) => ids.map((id) => grid.getHexById(id))

  it('outlines a single hex with all six edges, corners clockwise per direction', () => {
    const edges = outlineEdges(hexes([23]))
    expect(edges.map((edge) => [edge.fromCorner, edge.toCorner])).toEqual([
      [4, 5],
      [5, 0],
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
    ])
  })

  it('omits the shared edge of adjacent hexes', () => {
    // 23 and 16 are adjacent: each keeps its 5 outer edges.
    const edges = outlineEdges(hexes([23, 16]))
    expect(edges).toHaveLength(10)
    expect(edges.filter((edge) => edge.hex.getId() === 23)).toHaveLength(5)
    expect(edges.filter((edge) => edge.hex.getId() === 16)).toHaveLength(5)
  })

  it('outlines a full radius-2 zone with 30 edges, all on the outer ring', () => {
    // Around 23 both rings are fully on the board: the 6 corner tiles of the
    // outer ring expose 3 edges each, the 6 side tiles 2 each.
    const center = grid.getHexById(23)
    const zone = grid
      .getAllTiles()
      .map((tile) => tile.hex)
      .filter((hex) => center.distance(hex) <= 2)
    const edges = outlineEdges(zone)
    expect(edges).toHaveLength(30)
    for (const edge of edges) {
      expect(center.distance(edge.hex)).toBe(2)
    }
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

import { describe, expect, it } from 'vitest'

import { artifactHostHex, Grid, rotatedHexId } from '@/lib/grid'
import { State } from '@/lib/types/state'
import { Team } from '@/lib/types/team'
import { SMALL_GRID } from './fixtures/grid'

// Arena exercising every tile-state type on SMALL_GRID
const TEST_ARENA = {
  id: 1,
  name: 'Test',
  grid: [
    { type: State.AVAILABLE_ALLY, hex: [1, 2] },
    { type: State.AVAILABLE_ENEMY, hex: [3] },
    { type: State.BLOCKED, hex: [4] },
    { type: State.DEFAULT, hex: [5] },
  ],
}

describe('Grid', () => {
  it('should initialize with custom layout and map', () => {
    const grid = new Grid(SMALL_GRID, TEST_ARENA)

    expect(grid.getAllTiles()).toHaveLength(5)
    expect(grid.gridPreset).toBe(SMALL_GRID)

    // Check states are applied from TEST_ARENA
    expect(grid.getTileById(1).state).toBe(State.AVAILABLE_ALLY)
    expect(grid.getTileById(2).state).toBe(State.AVAILABLE_ALLY)
    expect(grid.getTileById(3).state).toBe(State.AVAILABLE_ENEMY)
    expect(grid.getTileById(4).state).toBe(State.BLOCKED)
    expect(grid.getTileById(5).state).toBe(State.DEFAULT)
  })
})

describe('artifactHostHex', () => {
  it('is the off-grid neighbour left of cell 1 (ally) and right of cell 45 (enemy)', () => {
    const grid = new Grid()
    const ally = artifactHostHex(grid, Team.ALLY)
    const enemy = artifactHostHex(grid, Team.ENEMY)

    expect(ally.equals(grid.getHexById(1).neighbor(4))).toBe(true)
    expect(enemy.equals(grid.getHexById(45).neighbor(1))).toBe(true)
    expect(grid.getTileOrUndefined(ally)).toBeUndefined()
    expect(grid.getTileOrUndefined(enemy)).toBeUndefined()
  })
})

describe('rotatedHexId', () => {
  it('maps a hex onto its 180-degree counterpart (46 - id on the full grid)', () => {
    const grid = new Grid()
    expect(rotatedHexId(grid, 1)).toBe(45)
    expect(rotatedHexId(grid, 45)).toBe(1)
    expect(rotatedHexId(grid, 14)).toBe(32)
    // The center cell rotates onto itself.
    expect(rotatedHexId(grid, 23)).toBe(23)
  })
})

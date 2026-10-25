import { describe, expect, it } from 'vitest'

import { artifactHostHex, Grid, rotatedHexId } from '@/lib/grid'
import { Team } from '@/lib/types/team'

describe('artifactHostHex', () => {
  it('lies off the grid for both teams', () => {
    const grid = new Grid()
    const ally = artifactHostHex(grid, Team.ALLY)
    const enemy = artifactHostHex(grid, Team.ENEMY)

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
    expect(rotatedHexId(grid, 23)).toBe(23)
  })
})

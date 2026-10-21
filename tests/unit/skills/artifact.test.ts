import { beforeEach, describe, expect, it } from 'vitest'

import { toPhantimalId } from '@/lib/characters/phantimal'
import { Grid } from '@/lib/grid'
import { artifactTargetArrows } from '@/lib/skills/artifact'
import { Team } from '@/lib/types/team'
import { placeOnTile, removeFromTile } from '../fixtures/skills'

const targetHexIds = (grid: Grid, team: Team, artifactName: string) =>
  artifactTargetArrows(grid, team, artifactName).map((arrow) => arrow.toHex.getId())

describe('artifact targeting', () => {
  let grid: Grid

  beforeEach(() => {
    grid = new Grid()
    // Ally ids rise toward the front: 20 is the frontmost ally, 5 the rearmost.
    placeOnTile(grid, 5, 100, Team.ALLY)
    placeOnTile(grid, 12, 101, Team.ALLY)
    placeOnTile(grid, 20, 102, Team.ALLY)
    // Enemy ids fall toward the front: 30 is the frontmost enemy, 40 the rearmost.
    placeOnTile(grid, 30, 200, Team.ENEMY)
    placeOnTile(grid, 40, 201, Team.ENEMY)
  })

  it('enlightening points at the rearmost unit of its slot team', () => {
    expect(targetHexIds(grid, Team.ALLY, 'enlightening')).toEqual([5])
    expect(targetHexIds(grid, Team.ENEMY, 'enlightening')).toEqual([40])
  })

  it('counts a phantimal as a unit', () => {
    placeOnTile(grid, 2, toPhantimalId(1), Team.ALLY)
    expect(targetHexIds(grid, Team.ALLY, 'enlightening')).toEqual([2])
  })

  // Retire with the season's entries in src/lib/skills/artifact.ts.
  describe('season 8', () => {
    it('soulbound links the frontmost and rearmost allies, once for a lone unit', () => {
      expect(targetHexIds(grid, Team.ALLY, 'soulbound')).toEqual([20, 5])
      removeFromTile(grid, 5)
      removeFromTile(grid, 12)
      expect(targetHexIds(grid, Team.ALLY, 'soulbound')).toEqual([20])
    })

    it('thundermight strikes the frontmost and rearmost enemies', () => {
      expect(targetHexIds(grid, Team.ALLY, 'thundermight')).toEqual([30, 40])
      expect(targetHexIds(grid, Team.ENEMY, 'thundermight')).toEqual([20, 5])
    })

    it('soulshock stuns the two frontmost enemies', () => {
      expect(targetHexIds(grid, Team.ENEMY, 'soulshock')).toEqual([20, 12])
      expect(targetHexIds(grid, Team.ALLY, 'soulshock')).toEqual([30, 40])
      removeFromTile(grid, 40)
      expect(targetHexIds(grid, Team.ALLY, 'soulshock')).toEqual([30])
    })
  })
})

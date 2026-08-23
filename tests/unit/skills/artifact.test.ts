import { beforeEach, describe, expect, it } from 'vitest'

import { toPhantimalId } from '@/lib/characters/phantimal'
import { artifactHostHex, Grid } from '@/lib/grid'
import { artifactTargetArrows } from '@/lib/skills/artifact'
import { Team } from '@/lib/types/team'
import { placeOnTile } from '../fixtures/skills'

const ENLIGHTENING = 3
const VANGUARD = 14
const VALORSHIELD = 18
// Awakening: no targeting rule.
const AWAKENING = 1

const targetHexIds = (grid: Grid, team: Team, artifactId: number | null) =>
  artifactTargetArrows(grid, team, artifactId).map((arrow) => arrow.toHex.getId())

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
    expect(targetHexIds(grid, Team.ALLY, ENLIGHTENING)).toEqual([5])
    expect(targetHexIds(grid, Team.ENEMY, ENLIGHTENING)).toEqual([40])
  })

  it('draws nothing for an empty slot, an artifact without targeting, or an empty team', () => {
    expect(artifactTargetArrows(grid, Team.ALLY, null)).toEqual([])
    expect(artifactTargetArrows(grid, Team.ALLY, AWAKENING)).toEqual([])

    for (const hexId of [5, 12, 20]) grid.getTileById(hexId).characterId = undefined
    expect(artifactTargetArrows(grid, Team.ALLY, ENLIGHTENING)).toEqual([])
  })

  it('counts phantimals and companions as units', () => {
    placeOnTile(grid, 2, toPhantimalId(1), Team.ALLY)
    expect(targetHexIds(grid, Team.ALLY, ENLIGHTENING)).toEqual([2])
  })

  it('starts every arrow at the slot team host cell', () => {
    for (const team of [Team.ALLY, Team.ENEMY]) {
      const [arrow] = artifactTargetArrows(grid, team, ENLIGHTENING)
      expect(arrow?.team).toBe(team)
      expect(arrow?.fromHex.equals(artifactHostHex(grid, team))).toBe(true)
    }
  })

  // Retire with src/lib/skills/seasonal/artifact.ts.
  describe('season 7', () => {
    it('vanguard points at the frontmost unit of its slot team', () => {
      expect(targetHexIds(grid, Team.ALLY, VANGUARD)).toEqual([20])
      expect(targetHexIds(grid, Team.ENEMY, VANGUARD)).toEqual([30])
    })

    it('valorshield points at both ends of its slot team', () => {
      expect(targetHexIds(grid, Team.ALLY, VALORSHIELD)).toEqual([20, 5])
      expect(targetHexIds(grid, Team.ENEMY, VALORSHIELD)).toEqual([30, 40])
    })

    it('valorshield collapses to one arrow for a lone unit', () => {
      grid.getTileById(5).characterId = undefined
      grid.getTileById(12).characterId = undefined
      expect(targetHexIds(grid, Team.ALLY, VALORSHIELD)).toEqual([20])
    })
  })
})

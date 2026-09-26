import { beforeEach, describe, expect, it } from 'vitest'

import { toPhantimalId } from '@/lib/characters/phantimal'
import { artifactHostHex, Grid } from '@/lib/grid'
import { artifactTargetArrows, artifactTargetingRules } from '@/lib/skills/artifact'
import { Team } from '@/lib/types/team'
import { loadArtifacts } from '@/utils/dataLoader'
import { placeOnTile, removeFromTile } from '../fixtures/skills'

const ENLIGHTENING = 3
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

    for (const hexId of [5, 12, 20]) removeFromTile(grid, hexId)
    expect(artifactTargetArrows(grid, Team.ALLY, ENLIGHTENING)).toEqual([])
  })

  it('counts a phantimal as a unit', () => {
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
})

describe('artifact targeting rules', () => {
  // Seasonal ids are reused, so a rule left behind at a cutover would name the
  // outgoing artifact while its id now holds the incoming one.
  it('names the artifact each rule is keyed to', () => {
    const nameById = new Map(loadArtifacts().map((artifact) => [artifact.id, artifact.name]))
    const stale = artifactTargetingRules().filter((rule) => nameById.get(rule.id) !== rule.name)
    expect(stale).toEqual([])
  })
})

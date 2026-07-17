import { beforeEach, describe, expect, it } from 'vitest'

import { Grid } from '@/lib/grid'
import { getCharacterSkill, SkillManager, type SkillContext } from '@/lib/skills/skill'
import { Team } from '@/lib/types/team'
import { placeOnTile } from '../fixtures/skills'

const GALAHAD = 99
const GALAHAD_HEX = 12 // neighbors: {6, 8, 9, 15, 16, 19}

// Pins the deliberate contrasts with niru: within a row galahad takes the
// LOWER hex id, and companions are not valid targets.
describe('galahad rear-row ally targeting', () => {
  let grid: Grid
  let skillManager: SkillManager

  const ctx = (): SkillContext => ({
    grid,
    hexId: GALAHAD_HEX,
    team: Team.ALLY,
    characterId: GALAHAD,
    skillManager,
  })

  const galahad = () => getCharacterSkill(GALAHAD)!
  const target = () => skillManager.getSkillTarget(GALAHAD, Team.ALLY)

  beforeEach(() => {
    grid = new Grid()
    skillManager = new SkillManager()
    placeOnTile(grid, GALAHAD_HEX, GALAHAD, Team.ALLY)
  })

  it('within a diagonal row, takes the lower hex id (8 over 9)', () => {
    placeOnTile(grid, 8, 1, Team.ALLY)
    placeOnTile(grid, 9, 2, Team.ALLY)

    galahad().onActivate(ctx())

    expect(target()?.targetHexId).toBe(8)
  })

  it('skips companions', () => {
    placeOnTile(grid, 8, 10005, Team.ALLY) // would win by id if targetable
    placeOnTile(grid, 9, 1, Team.ALLY)

    galahad().onActivate(ctx())

    expect(target()?.targetHexId).toBe(9)
    expect(target()?.targetCharacterId).toBe(1)
  })
})

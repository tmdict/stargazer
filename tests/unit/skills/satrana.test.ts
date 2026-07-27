import { beforeEach, describe, expect, it } from 'vitest'

import { Grid } from '@/lib/grid'
import { getCharacterSkill, SkillManager, type SkillContext } from '@/lib/skills/skill'
import { Team } from '@/lib/types/team'
import { placeOnTile } from '../fixtures/skills'

const SATRANA = 35
// Distance 1 from hex 9: {4, 6, 7, 12, 13, 16};
// distance 2: {1, 2, 3, 5, 8, 10, 15, 17, 19, 20, 23}
const SATRANA_HEX = 9

describe('satrana sparks highlighting', () => {
  let grid: Grid
  let skillManager: SkillManager

  const ctx = (): SkillContext => ({
    grid,
    hexId: SATRANA_HEX,
    team: Team.ALLY,
    characterId: SATRANA,
    skillManager,
  })

  const satrana = () => getCharacterSkill(SATRANA)!

  beforeEach(() => {
    grid = new Grid()
    skillManager = new SkillManager()
    placeOnTile(grid, SATRANA_HEX, SATRANA, Team.ALLY)
  })

  it('tints allies at distance 1 and 2', () => {
    placeOnTile(grid, 4, 1, Team.ALLY) // distance 1
    placeOnTile(grid, 23, 2, Team.ALLY) // distance 2

    satrana().onActivate(ctx())

    expect(skillManager.getTileFillModifier(4)).toHaveLength(1)
    expect(skillManager.getTileFillModifier(23)).toHaveLength(1)
  })

  it('ignores allies beyond 2 tiles', () => {
    placeOnTile(grid, 25, 1, Team.ALLY)

    satrana().onActivate(ctx())

    expect(skillManager.getTileFillModifier(25)).toBeUndefined()
  })

  it('does not tint her own tile', () => {
    satrana().onActivate(ctx())

    expect(skillManager.getTileFillModifier(SATRANA_HEX)).toBeUndefined()
  })

  it('ignores units on the other team', () => {
    placeOnTile(grid, 12, 1, Team.ENEMY)

    satrana().onActivate(ctx())

    expect(skillManager.getTileFillModifier(12)).toBeUndefined()
  })

  it('clears tints on deactivate', () => {
    placeOnTile(grid, 4, 1, Team.ALLY)
    satrana().onActivate(ctx())
    expect(skillManager.getTileFillModifier(4)).toBeDefined()

    satrana().onDeactivate(ctx())

    expect(skillManager.getTileFillModifier(4)).toBeUndefined()
  })

  it('follows an ally that moves on update', () => {
    placeOnTile(grid, 4, 1, Team.ALLY)
    satrana().onActivate(ctx())
    expect(skillManager.getTileFillModifier(4)).toBeDefined()

    grid.getTileById(4).characterId = undefined
    grid.getTileById(4).team = undefined
    placeOnTile(grid, 23, 1, Team.ALLY)
    satrana().onUpdate!(ctx())

    expect(skillManager.getTileFillModifier(4)).toBeUndefined()
    expect(skillManager.getTileFillModifier(23)).toHaveLength(1)
  })
})

import { beforeEach, describe, expect, it } from 'vitest'

import { Grid } from '@/lib/grid'
import { getCharacterSkill, SkillManager, type SkillContext } from '@/lib/skills/skill'
import { Team } from '@/lib/types/team'
import { placeOnTile } from '../fixtures/skills'

const HIMMEL = 112
const HIMMEL_HEX = 9 // neighbors: {4, 6, 7, 12, 13, 16}

// Hand-built class lookup standing in for the data-store resolver.
const CLASS_BY_ID: Record<number, string> = {
  1: 'tank',
  2: 'mage',
  3: 'support',
  4: 'tank', // second tank, for tiebreaks
  5: 'warrior', // a class the skill ignores
}
const classOf = (id: number): string | undefined => CLASS_BY_ID[id]

describe('himmel class-trio highlighting', () => {
  let grid: Grid
  let skillManager: SkillManager

  const ctx = (): SkillContext => ({
    grid,
    hexId: HIMMEL_HEX,
    team: Team.ALLY,
    characterId: HIMMEL,
    skillManager,
    lookups: { classOf },
  })

  const himmel = () => getCharacterSkill(HIMMEL)!

  beforeEach(() => {
    grid = new Grid()
    skillManager = new SkillManager()
    placeOnTile(grid, HIMMEL_HEX, HIMMEL, Team.ALLY)
  })

  it('highlights one tank, mage, and support among the neighbors', () => {
    placeOnTile(grid, 16, 1, Team.ALLY) // tank
    placeOnTile(grid, 12, 2, Team.ALLY) // mage
    placeOnTile(grid, 6, 3, Team.ALLY) // support

    himmel().onActivate(ctx())

    expect(skillManager.getTileFillModifier(16)).toHaveLength(1)
    expect(skillManager.getTileFillModifier(12)).toHaveLength(1)
    expect(skillManager.getTileFillModifier(6)).toHaveLength(1)
  })

  it('highlights nothing when a required class is missing', () => {
    placeOnTile(grid, 16, 1, Team.ALLY) // tank
    placeOnTile(grid, 12, 2, Team.ALLY) // mage, but no support

    himmel().onActivate(ctx())

    expect(skillManager.getTileFillModifier(16)).toBeUndefined()
    expect(skillManager.getTileFillModifier(12)).toBeUndefined()
  })

  it('ignores neighbors whose class is not tank/mage/support', () => {
    placeOnTile(grid, 16, 1, Team.ALLY) // tank
    placeOnTile(grid, 12, 2, Team.ALLY) // mage
    placeOnTile(grid, 6, 5, Team.ALLY) // warrior, not a support

    himmel().onActivate(ctx())

    expect(skillManager.getTileFillModifier(16)).toBeUndefined()
    expect(skillManager.getTileFillModifier(12)).toBeUndefined()
    expect(skillManager.getTileFillModifier(6)).toBeUndefined()
  })

  it('ignores units on the other team', () => {
    placeOnTile(grid, 16, 1, Team.ENEMY) // tank, but enemy
    placeOnTile(grid, 12, 2, Team.ALLY) // mage
    placeOnTile(grid, 6, 3, Team.ALLY) // support

    himmel().onActivate(ctx())

    // No ally tank adjacent, so the trio is incomplete and nothing highlights.
    expect(skillManager.getTileFillModifier(12)).toBeUndefined()
    expect(skillManager.getTileFillModifier(6)).toBeUndefined()
  })

  it('scans diagonal rows back-to-front: a deeper-row tank (4) beats a nearer-row tank (7)', () => {
    placeOnTile(grid, 4, 1, Team.ALLY) // tank, diagonal row q-r = -6
    placeOnTile(grid, 7, 4, Team.ALLY) // tank, diagonal row q-r = -5
    placeOnTile(grid, 12, 2, Team.ALLY) // mage
    placeOnTile(grid, 16, 3, Team.ALLY) // support

    himmel().onActivate(ctx())

    expect(skillManager.getTileFillModifier(4)).toHaveLength(1)
    expect(skillManager.getTileFillModifier(7)).toBeUndefined()
    expect(skillManager.getTileFillModifier(12)).toBeDefined()
    expect(skillManager.getTileFillModifier(16)).toBeDefined()
  })

  it('within a diagonal row, takes the higher hex id for an ally (7 over 6)', () => {
    placeOnTile(grid, 6, 1, Team.ALLY) // tank, diagonal row q-r = -5
    placeOnTile(grid, 7, 4, Team.ALLY) // tank, same row, higher id wins
    placeOnTile(grid, 12, 2, Team.ALLY) // mage
    placeOnTile(grid, 16, 3, Team.ALLY) // support

    himmel().onActivate(ctx())

    expect(skillManager.getTileFillModifier(7)).toHaveLength(1)
    expect(skillManager.getTileFillModifier(6)).toBeUndefined()
  })

  it('only considers immediately adjacent units (maxDistance 1)', () => {
    placeOnTile(grid, 5, 1, Team.ALLY) // tank two tiles away from Himmel
    placeOnTile(grid, 12, 2, Team.ALLY) // mage, adjacent
    placeOnTile(grid, 6, 3, Team.ALLY) // support, adjacent

    himmel().onActivate(ctx())

    // The only tank is not adjacent, so the trio is incomplete.
    expect(skillManager.getTileFillModifier(12)).toBeUndefined()
    expect(skillManager.getTileFillModifier(6)).toBeUndefined()
  })

  it('clears highlights on deactivate', () => {
    placeOnTile(grid, 16, 1, Team.ALLY)
    placeOnTile(grid, 12, 2, Team.ALLY)
    placeOnTile(grid, 6, 3, Team.ALLY)
    himmel().onActivate(ctx())
    expect(skillManager.getTileFillModifier(16)).toBeDefined()

    himmel().onDeactivate(ctx())

    expect(skillManager.getTileFillModifier(16)).toBeUndefined()
    expect(skillManager.getTileFillModifier(12)).toBeUndefined()
    expect(skillManager.getTileFillModifier(6)).toBeUndefined()
  })

  it('clears the highlight on update once the trio is broken', () => {
    placeOnTile(grid, 16, 1, Team.ALLY)
    placeOnTile(grid, 12, 2, Team.ALLY)
    placeOnTile(grid, 6, 3, Team.ALLY)
    himmel().onActivate(ctx())
    expect(skillManager.getTileFillModifier(6)).toBeDefined()

    grid.getTileById(6).characterId = undefined
    grid.getTileById(6).team = undefined
    himmel().onUpdate!(ctx())

    expect(skillManager.getTileFillModifier(16)).toBeUndefined()
    expect(skillManager.getTileFillModifier(12)).toBeUndefined()
  })
})

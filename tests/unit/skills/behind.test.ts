import { beforeEach, describe, expect, it } from 'vitest'

import { Grid } from '@/lib/grid'
import { getCharacterSkill, SkillManager, type SkillContext } from '@/lib/skills/skill'
import { directlyBehindHexId, findUnitBehind } from '@/lib/skills/utils/targeting'
import { Team } from '@/lib/types/team'
import { placeOnTile } from '../fixtures/skills'

// Several heroes share the behind-highlight skill; Gunnar stands in for all of them here.
const GUNNAR = 106

describe('directlyBehindHexId', () => {
  let grid: Grid

  beforeEach(() => {
    grid = new Grid()
  })

  it('picks the back-row neighbor for an interior tile', () => {
    expect(directlyBehindHexId(grid, 23, Team.ALLY)).toBe(16)
    // Enemies face the other way: the same tile's behind is the mirror neighbor.
    expect(directlyBehindHexId(grid, 23, Team.ENEMY)).toBe(30)
  })

  it('is undefined when the behind tile is off the board, even with a back-row diagonal', () => {
    // Hexes 4 and 14 keep a bottom-right neighbour (1 and 10), but their true
    // behind tile lies outside the board; the diagonal never substitutes.
    expect(directlyBehindHexId(grid, 4, Team.ALLY)).toBeUndefined()
    expect(directlyBehindHexId(grid, 14, Team.ALLY)).toBeUndefined()
    expect(directlyBehindHexId(grid, 42, Team.ENEMY)).toBeUndefined()
  })

  it('is undefined at the rearmost tile, where nothing lies behind', () => {
    expect(directlyBehindHexId(grid, 1, Team.ALLY)).toBeUndefined()
    expect(directlyBehindHexId(grid, 45, Team.ENEMY)).toBeUndefined()
  })

  it('ignores a same-row side neighbor (beside, not behind)', () => {
    // These back-edge tiles have only a same-row side neighbour, not a tile behind.
    expect(directlyBehindHexId(grid, 3, Team.ALLY)).toBeUndefined()
    expect(directlyBehindHexId(grid, 11, Team.ALLY)).toBeUndefined()
    expect(directlyBehindHexId(grid, 35, Team.ENEMY)).toBeUndefined()
    expect(directlyBehindHexId(grid, 43, Team.ENEMY)).toBeUndefined()
  })
})

describe('findUnitBehind', () => {
  let grid: Grid

  const ctx = (): SkillContext => ({
    grid,
    hexId: 23,
    team: Team.ALLY,
    characterId: GUNNAR,
    skillManager: new SkillManager(),
  })

  beforeEach(() => {
    grid = new Grid()
    placeOnTile(grid, 23, GUNNAR, Team.ALLY)
  })

  it('targets a same-team unit on the tile directly behind', () => {
    placeOnTile(grid, 16, 100, Team.ALLY)
    expect(findUnitBehind(ctx())).toEqual({ targetHexId: 16, targetCharacterId: 100 })
  })

  it('returns null when the tile behind is empty', () => {
    expect(findUnitBehind(ctx())).toBeNull()
  })

  it('ignores a unit from the other team on the tile behind', () => {
    placeOnTile(grid, 16, 200, Team.ENEMY)
    expect(findUnitBehind(ctx())).toBeNull()
  })
})

describe('behind-tile highlight skill', () => {
  let grid: Grid
  let skillManager: SkillManager

  const ctx = (): SkillContext => ({
    grid,
    hexId: 23,
    team: Team.ALLY,
    characterId: GUNNAR,
    skillManager,
  })

  beforeEach(() => {
    grid = new Grid()
    skillManager = new SkillManager()
    placeOnTile(grid, 23, GUNNAR, Team.ALLY)
  })

  it('highlights the ally behind on activate and clears it on deactivate', () => {
    placeOnTile(grid, 16, 100, Team.ALLY)
    const skill = getCharacterSkill(GUNNAR)!

    skill.onActivate(ctx())
    expect(skillManager.getTileFillModifier(16)).toBeDefined()

    skill.onDeactivate(ctx())
    expect(skillManager.getTileFillModifier(16)).toBeUndefined()
  })

  it('does not highlight a unit beside the caster (tile 1 is beside tile 3, not behind)', () => {
    const grid3 = new Grid()
    const sm = new SkillManager()
    placeOnTile(grid3, 3, GUNNAR, Team.ALLY)
    placeOnTile(grid3, 1, 100, Team.ALLY)

    getCharacterSkill(GUNNAR)!.onActivate({
      grid: grid3,
      hexId: 3,
      team: Team.ALLY,
      characterId: GUNNAR,
      skillManager: sm,
    })

    expect(sm.getTileFillModifier(1)).toBeUndefined()
  })

  it('does not highlight the back-row diagonal when the behind tile is off the board', () => {
    const grid4 = new Grid()
    const sm = new SkillManager()
    placeOnTile(grid4, 4, GUNNAR, Team.ALLY)
    placeOnTile(grid4, 1, 100, Team.ALLY)

    getCharacterSkill(GUNNAR)!.onActivate({
      grid: grid4,
      hexId: 4,
      team: Team.ALLY,
      characterId: GUNNAR,
      skillManager: sm,
    })

    expect(sm.getTileFillModifier(1)).toBeUndefined()
  })
})

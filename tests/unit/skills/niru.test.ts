import { beforeEach, describe, expect, it } from 'vitest'

import { Grid } from '@/lib/grid'
import { getCharacterSkill, SkillManager, type SkillContext } from '@/lib/skills/skill'
import { Team } from '@/lib/types/team'
import { placeOnTile } from '../fixtures/skills'

const NIRU = 28
const NIRU_HEX = 12 // neighbors: {6, 8, 9, 15, 16, 19}

describe('niru rear-row, front-of-row ally targeting', () => {
  let grid: Grid
  let skillManager: SkillManager

  const ctx = (): SkillContext => ({
    grid,
    hexId: NIRU_HEX,
    team: Team.ALLY,
    characterId: NIRU,
    skillManager,
  })

  const niru = () => getCharacterSkill(NIRU)!
  const target = () => skillManager.getSkillTarget(NIRU, Team.ALLY)

  beforeEach(() => {
    grid = new Grid()
    skillManager = new SkillManager()
    placeOnTile(grid, NIRU_HEX, NIRU, Team.ALLY)
  })

  it('within a diagonal row, takes the higher hex id (9 over 8) and draws the arrow', () => {
    placeOnTile(grid, 8, 1, Team.ALLY) // diagonal row q-r = -4
    placeOnTile(grid, 9, 2, Team.ALLY) // same row, higher id wins

    niru().onActivate(ctx())

    expect(target()?.targetHexId).toBe(9)
    expect(target()?.metadata?.arrows).toEqual([{ fromHexId: NIRU_HEX, toHexId: 9, type: 'ally' }])
  })

  it('reaches rear diagonal rows first (6 over 9)', () => {
    placeOnTile(grid, 6, 1, Team.ALLY) // diagonal row -5
    placeOnTile(grid, 9, 2, Team.ALLY) // diagonal row -4, same distance

    niru().onActivate(ctx())

    expect(target()?.targetHexId).toBe(6)
  })

  it('distance outranks rows: an adjacent front-row unit beats a distant rear one', () => {
    placeOnTile(grid, 16, 1, Team.ALLY) // distance 1, diagonal row -2
    placeOnTile(grid, 1, 2, Team.ALLY) // distance 2, diagonal row -7

    niru().onActivate(ctx())

    expect(target()?.targetHexId).toBe(16)
  })

  it('targets companions like any other unit', () => {
    placeOnTile(grid, 9, 10005, Team.ALLY) // companion of character 5
    placeOnTile(grid, 8, 1, Team.ALLY)

    niru().onActivate(ctx())

    expect(target()?.targetHexId).toBe(9)
    expect(target()?.targetCharacterId).toBe(10005)
  })

  it('clears the target on deactivate', () => {
    placeOnTile(grid, 9, 1, Team.ALLY)
    niru().onActivate(ctx())
    expect(target()).toBeDefined()

    niru().onDeactivate(ctx())

    expect(target()).toBeUndefined()
  })
})

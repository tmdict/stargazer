import { beforeEach, describe, expect, it } from 'vitest'

import { Grid } from '@/lib/grid'
import { getCharacterSkill, SkillManager, type SkillContext } from '@/lib/skills/skill'
import { getSymmetricalHexId } from '@/lib/skills/utils/symmetry'
import { Team } from '@/lib/types/team'
import { placeOnTile } from '../fixtures/skills'

const REINIER = 31
const REINIER_HEX = 23
const ALLY_HEX = 16 // adjacent to cell 23

describe('reinier tile highlighting', () => {
  let grid: Grid
  let skillManager: SkillManager
  let enemyHex: number

  const ctx = (): SkillContext => ({
    grid,
    hexId: REINIER_HEX,
    team: Team.ALLY,
    characterId: REINIER,
    skillManager,
  })

  const reinier = () => getCharacterSkill(REINIER)!

  beforeEach(() => {
    grid = new Grid()
    skillManager = new SkillManager()
    enemyHex = getSymmetricalHexId(grid, ALLY_HEX)!
    placeOnTile(grid, REINIER_HEX, REINIER, Team.ALLY)
    placeOnTile(grid, ALLY_HEX, 100, Team.ALLY)
  })

  it('highlights the ally and its symmetrical enemy tile when a valid pair exists', () => {
    placeOnTile(grid, enemyHex, 200, Team.ENEMY)

    reinier().onActivate(ctx())

    const allyHighlight = skillManager.getTileColorModifier(ALLY_HEX)
    expect(allyHighlight).toHaveLength(1)
    // Both tiles carry the same highlight (color value itself is a design const).
    expect(skillManager.getTileColorModifier(enemyHex)).toEqual(allyHighlight)
  })

  it('highlights nothing when the symmetrical tile has no enemy', () => {
    reinier().onActivate(ctx())

    expect(skillManager.getTileColorModifier(ALLY_HEX)).toBeUndefined()
    expect(skillManager.getTileColorModifier(enemyHex)).toBeUndefined()
  })

  it('clears the highlight on deactivate', () => {
    placeOnTile(grid, enemyHex, 200, Team.ENEMY)
    reinier().onActivate(ctx())
    expect(skillManager.getTileColorModifier(ALLY_HEX)).toBeDefined()

    reinier().onDeactivate(ctx())

    expect(skillManager.getTileColorModifier(ALLY_HEX)).toBeUndefined()
    expect(skillManager.getTileColorModifier(enemyHex)).toBeUndefined()
  })

  it('clears the highlight on update once the pair disappears', () => {
    placeOnTile(grid, enemyHex, 200, Team.ENEMY)
    reinier().onActivate(ctx())
    expect(skillManager.getTileColorModifier(ALLY_HEX)).toBeDefined()

    grid.getTileById(enemyHex).characterId = undefined
    grid.getTileById(enemyHex).team = undefined
    reinier().onUpdate!(ctx())

    expect(skillManager.getTileColorModifier(ALLY_HEX)).toBeUndefined()
    expect(skillManager.getTileColorModifier(enemyHex)).toBeUndefined()
  })
})

import { beforeEach, describe, expect, it } from 'vitest'

import { Grid } from '@/lib/grid'
import { getCharacterSkill, SkillManager, type SkillContext } from '@/lib/skills/skill'
import { SKILL_COLORS } from '@/lib/skills/utils/colors'
import { Team } from '@/lib/types/team'
import { placeOnTile } from '../fixtures/skills'

const SATRANA = 35
const CENTER = 23 // both rings fully on the board

describe('satrana sparks-zone outline', () => {
  let grid: Grid
  let skillManager: SkillManager

  const ctx = (hexId = CENTER): SkillContext => ({
    grid,
    hexId,
    team: Team.ALLY,
    characterId: SATRANA,
    skillManager,
  })

  const satrana = () => getCharacterSkill(SATRANA)!

  beforeEach(() => {
    grid = new Grid()
    skillManager = new SkillManager()
    placeOnTile(grid, CENTER, SATRANA, Team.ALLY)
  })

  it('outlines her 2-tile zone in red', () => {
    satrana().onActivate(ctx())

    const lines = skillManager.getSkillLines()
    expect(lines).toHaveLength(30)
    const center = grid.getHexById(CENTER)
    for (const line of lines) {
      expect(line.color).toBe(SKILL_COLORS.red)
      expect(center.distance(grid.getHexById(line.fromHexId))).toBe(2)
    }
  })

  it('moves the outline with her on update', () => {
    satrana().onActivate(ctx())

    satrana().onUpdate!(ctx(6))

    const center = grid.getHexById(6)
    const lines = skillManager.getSkillLines()
    expect(lines).not.toHaveLength(0)
    for (const line of lines) {
      expect(center.distance(grid.getHexById(line.fromHexId))).toBeLessThanOrEqual(2)
    }
  })

  it('clears the outline on deactivate', () => {
    satrana().onActivate(ctx())
    expect(skillManager.getSkillLines()).not.toHaveLength(0)

    satrana().onDeactivate(ctx())

    expect(skillManager.getSkillLines()).toHaveLength(0)
  })
})

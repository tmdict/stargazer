import { beforeEach, describe, expect, it } from 'vitest'

import { Grid } from '@/lib/grid'
import { getCharacterSkill, SkillManager, type SkillContext } from '@/lib/skills/skill'
import { SKILL_COLORS } from '@/lib/skills/utils/colors'
import { Team } from '@/lib/types/team'
import { placeOnTile } from '../fixtures/skills'

// Callan (shield) and Satrana (sparks) share the radius-2 zone-outline skill,
// differing only in color; the lifecycle tests run through Callan alone.
const CALLAN = 70
const SATRANA = 35
const INTERIOR_HEX = 23 // both rings fully on the board
const EDGE_HEX = 6 // ring 2 only partially on the board

describe('radius-2 zone-outline skills (callan, satrana)', () => {
  let grid: Grid
  let skillManager: SkillManager

  const ctx = (hexId: number, characterId = CALLAN): SkillContext => ({
    grid,
    hexId,
    team: Team.ALLY,
    characterId,
    skillManager,
  })

  const callan = () => getCharacterSkill(CALLAN)!

  beforeEach(() => {
    grid = new Grid()
    skillManager = new SkillManager()
  })

  it.each([
    { name: 'callan', characterId: CALLAN, color: SKILL_COLORS.green },
    { name: 'satrana', characterId: SATRANA, color: SKILL_COLORS.red },
  ])('draws the 30-segment perimeter of a full 2-tile zone for $name', ({ characterId, color }) => {
    placeOnTile(grid, INTERIOR_HEX, characterId, Team.ALLY)
    getCharacterSkill(characterId)!.onActivate(ctx(INTERIOR_HEX, characterId))

    const lines = skillManager.getSkillLines()
    expect(lines).toHaveLength(30)
    const center = grid.getHexById(INTERIOR_HEX)
    for (const line of lines) {
      expect(line.fromHexId).toBe(line.toHexId)
      expect(line.fromCorner).toBeDefined()
      expect(line.color).toBe(color)
      expect(center.distance(grid.getHexById(line.fromHexId))).toBe(2)
    }
  })

  it('follows the board edge when the zone is clipped', () => {
    placeOnTile(grid, EDGE_HEX, CALLAN, Team.ALLY)
    callan().onActivate(ctx(EDGE_HEX))

    const lines = skillManager.getSkillLines()
    const center = grid.getHexById(EDGE_HEX)
    // Where the outer ring runs off the board, the boundary falls back to
    // edges of nearer tiles along the board edge.
    expect(lines.some((line) => center.distance(grid.getHexById(line.fromHexId)) < 2)).toBe(true)
    for (const line of lines) {
      expect(center.distance(grid.getHexById(line.fromHexId))).toBeLessThanOrEqual(2)
    }
  })

  it('moves the outline with the caster on update', () => {
    placeOnTile(grid, INTERIOR_HEX, CALLAN, Team.ALLY)
    callan().onActivate(ctx(INTERIOR_HEX))

    callan().onUpdate!(ctx(EDGE_HEX))

    const center = grid.getHexById(EDGE_HEX)
    const lines = skillManager.getSkillLines()
    expect(lines).not.toHaveLength(0)
    for (const line of lines) {
      expect(center.distance(grid.getHexById(line.fromHexId))).toBeLessThanOrEqual(2)
    }
  })

  it('clears the outline on deactivate', () => {
    placeOnTile(grid, INTERIOR_HEX, CALLAN, Team.ALLY)
    callan().onActivate(ctx(INTERIOR_HEX))
    expect(skillManager.getSkillLines()).not.toHaveLength(0)

    callan().onDeactivate(ctx(INTERIOR_HEX))

    expect(skillManager.getSkillLines()).toHaveLength(0)
  })
})

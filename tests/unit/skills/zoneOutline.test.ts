import { beforeEach, describe, expect, it } from 'vitest'

import { Grid } from '@/lib/grid'
import { getCharacterSkill, SkillManager, type SkillContext } from '@/lib/skills/skill'
import { Team } from '@/lib/types/team'
import { placeOnTile } from '../fixtures/skills'

// Callan (shield) and Satrana (sparks) share the radius-2 zone-outline skill,
// differing only in color, so Callan stands in for both.
const CALLAN = 70
const INTERIOR_HEX = 23 // both rings fully on the board
const EDGE_HEX = 6 // ring 2 only partially on the board

describe('radius-2 zone-outline skills (callan, satrana)', () => {
  let grid: Grid
  let skillManager: SkillManager

  const ctx = (hexId: number): SkillContext => ({
    grid,
    hexId,
    team: Team.ALLY,
    characterId: CALLAN,
    skillManager,
  })

  const callan = () => getCharacterSkill(CALLAN)!

  beforeEach(() => {
    grid = new Grid()
    skillManager = new SkillManager()
  })

  it('draws the 30-segment perimeter of a full 2-tile zone', () => {
    placeOnTile(grid, INTERIOR_HEX, CALLAN, Team.ALLY)
    callan().onActivate(ctx(INTERIOR_HEX))

    const lines = skillManager.getSkillLines()
    expect(lines).toHaveLength(30)
    const center = grid.getHexById(INTERIOR_HEX)
    for (const line of lines) {
      expect(line.fromHexId).toBe(line.toHexId)
      expect(line.fromCorner).toBeDefined()
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
})

import { beforeEach, describe, expect, it } from 'vitest'

import { Grid } from '@/lib/grid'
import { getCharacterSkill, SkillManager, type SkillContext } from '@/lib/skills/skill'
import { Team } from '@/lib/types/team'
import { NO_LOOKUPS, placeOnTile } from '../fixtures/skills'

const TAICHI_AGUMON = 123

describe('taichi-agumon behind line', () => {
  let grid: Grid
  let skillManager: SkillManager

  const draw = (hexId: number, team: Team) => {
    placeOnTile(grid, hexId, TAICHI_AGUMON, team)
    const ctx: SkillContext = {
      grid,
      hexId,
      team,
      characterId: TAICHI_AGUMON,
      skillManager,
      lookups: NO_LOOKUPS,
    }
    getCharacterSkill(TAICHI_AGUMON)!.onActivate(ctx)
    return skillManager.getSkillLines()
  }

  // Each line is one tile edge (corners (d + 4) % 6 and (d + 5) % 6 face
  // direction d): the tile it is drawn on, and the on-board tile across it.
  const sides = (line: { fromHexId: number; fromCorner?: number }) => {
    const hex = grid.getHexById(line.fromHexId)
    const across = grid.getTileOrUndefined(hex.neighbor((line.fromCorner! + 2) % 6))
    return { row: hex.getDiagonal(), acrossRow: across?.hex.getDiagonal() }
  }

  beforeEach(() => {
    grid = new Grid()
    skillManager = new SkillManager(NO_LOOKUPS)
  })

  // Cell 23 is (0, 0, 0), on diagonal row 0. The board has 13 edges between a
  // lower row and row 0 or above, so 13 distinct such edges are all of them,
  // and none runs along the board's rim.
  it('runs between the rows behind an ally and the rest of the board', () => {
    const lines = draw(23, Team.ALLY)
    for (const line of lines) {
      const { row, acrossRow } = sides(line)
      expect(row).toBeLessThan(0)
      expect(acrossRow).toBeGreaterThanOrEqual(0)
    }
    expect(lines).toHaveLength(13)
    expect(new Set(lines.map((line) => `${line.fromHexId}:${line.fromCorner}`)).size).toBe(13)
  })

  // The board is point-symmetric, so the enemy's line has the ally's 13 edges.
  it('takes the higher rows as behind an enemy', () => {
    const lines = draw(23, Team.ENEMY)
    for (const line of lines) {
      const { row, acrossRow } = sides(line)
      expect(row).toBeGreaterThan(0)
      expect(acrossRow).toBeLessThanOrEqual(0)
    }
    expect(lines).toHaveLength(13)
  })

  it('draws nothing from the rearmost row', () => {
    // Cell 1 is on the ally's back row (diagonal -7), so no ally can be behind.
    expect(draw(1, Team.ALLY)).toEqual([])
  })
})

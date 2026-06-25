import { beforeEach, describe, expect, it } from 'vitest'

import { Grid } from '@/lib/grid'
import { getCharacterSkill, SkillManager, type SkillContext } from '@/lib/skills/skill'
import { Team } from '@/lib/types/team'
import { placeOnTile } from '../fixtures/skills'

const ZANDROK = 88

describe('zandrok wedge boundary lines', () => {
  let grid: Grid
  let skillManager: SkillManager

  const buildContext = (hexId: number): SkillContext => ({
    grid,
    hexId,
    team: Team.ALLY,
    characterId: ZANDROK,
    skillManager,
  })

  const sOf = (hexId: number) => grid.getHexById(hexId).s

  // The exact cells of each line (for the canonical placement).
  const edges = () =>
    skillManager.getSkillLines().map(({ fromHexId, toHexId, fromCorner, toCorner }) => ({
      fromHexId,
      toHexId,
      fromCorner,
      toCorner,
    }))

  // The lane (s) each line sits on, to assert geometry that survives map detail.
  const lanes = () =>
    skillManager.getSkillLines().map(({ fromHexId, toHexId, fromCorner }) => ({
      fromS: sOf(fromHexId),
      toS: sOf(toHexId),
      corner: fromCorner,
    }))

  beforeEach(() => {
    grid = new Grid()
    skillManager = new SkillManager()
  })

  // Zandrok on cell 4 (s = 0): the band is s in [-2, 2]. The high edge runs the s=2
  // lane (cells 5..43) along corner 3, the low edge the s=-2 lane (cells 3..41) along
  // corner 0 — the two outer vertices that wrap the 5 lanes.
  it('draws both band edges centered on Zandrok', () => {
    placeOnTile(grid, 4, ZANDROK, Team.ALLY)
    getCharacterSkill(ZANDROK)!.onActivate(buildContext(4))

    expect(edges()).toEqual(
      expect.arrayContaining([
        { fromHexId: 5, toHexId: 43, fromCorner: 3, toCorner: 3 },
        { fromHexId: 3, toHexId: 41, fromCorner: 0, toCorner: 0 },
      ]),
    )
    expect(edges()).toHaveLength(2)
  })

  it('re-centers the band on the lane where Zandrok stands', () => {
    // Cell 26 = (1,0,-1), s = -1, so the band shifts to s in [-3, 1]. Assert the lanes
    // (not exact ids): the high edge runs the s_z+2 lane along corner 3, the low edge
    // the s_z-2 lane along corner 0, with both endpoints on their lane.
    placeOnTile(grid, 26, ZANDROK, Team.ALLY)
    getCharacterSkill(ZANDROK)!.onUpdate!(buildContext(26))

    expect(lanes()).toEqual(
      expect.arrayContaining([
        { fromS: 1, toS: 1, corner: 3 },
        { fromS: -3, toS: -3, corner: 0 },
      ]),
    )
  })

  it('clamps an off-grid edge lane to the grid boundary', () => {
    // Cell 5 = (-4,2,2), s = 2: the band [0, 4] runs past the top edge (grid max s = 3),
    // so the high edge clamps to the s=3 boundary lane rather than vanishing.
    placeOnTile(grid, 5, ZANDROK, Team.ALLY)
    getCharacterSkill(ZANDROK)!.onActivate(buildContext(5))

    expect(lanes()).toEqual(
      expect.arrayContaining([
        { fromS: 3, toS: 3, corner: 3 }, // clamped from s_z + 2 = 4
        { fromS: 0, toS: 0, corner: 0 }, // s_z - 2, on grid
      ]),
    )
    expect(lanes()).toHaveLength(2)
  })

  it('clears the lines on deactivate', () => {
    placeOnTile(grid, 4, ZANDROK, Team.ALLY)
    const ctx = buildContext(4)
    getCharacterSkill(ZANDROK)!.onActivate(ctx)
    expect(skillManager.getSkillLines()).toHaveLength(2)

    getCharacterSkill(ZANDROK)!.onDeactivate(ctx)

    expect(skillManager.getSkillLines()).toEqual([])
  })
})

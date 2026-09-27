import { beforeEach, describe, expect, it } from 'vitest'

import { Grid } from '@/lib/grid'
import {
  directlyBehindHexId,
  findAdjacentPriorityTarget,
  findUnitBehind,
} from '@/lib/skills/utils/targeting'
import { Team } from '@/lib/types/team'
import { makeSkillContext, placeOnTile } from '../../fixtures/skills'

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
})

const CASTER = 500

describe('findUnitBehind', () => {
  let grid: Grid

  beforeEach(() => {
    grid = new Grid()
    placeOnTile(grid, 23, CASTER, Team.ALLY)
  })

  it('targets a same-team unit on the tile directly behind', () => {
    placeOnTile(grid, 16, 100, Team.ALLY)
    expect(findUnitBehind(makeSkillContext(grid, 23, Team.ALLY, CASTER))).toEqual({
      targetHexId: 16,
      targetCharacterId: 100,
    })
  })

  it('ignores a unit from the other team on the tile behind', () => {
    placeOnTile(grid, 16, 200, Team.ENEMY)
    expect(findUnitBehind(makeSkillContext(grid, 23, Team.ALLY, CASTER))).toBeNull()
  })
})

describe('findAdjacentPriorityTarget', () => {
  let grid: Grid

  beforeEach(() => {
    grid = new Grid()
  })

  // Ally on 23: priority 16 (straight behind) > 20 (left) > 19 (bottom-right).
  describe('behind (default)', () => {
    it('prefers the tile directly behind', () => {
      placeOnTile(grid, 23, CASTER, Team.ALLY)
      placeOnTile(grid, 16, 100, Team.ALLY)
      placeOnTile(grid, 20, 101, Team.ALLY)
      placeOnTile(grid, 19, 102, Team.ALLY)

      const info = findAdjacentPriorityTarget(makeSkillContext(grid, 23, Team.ALLY, CASTER))
      expect(info?.targetHexId).toBe(16)
      expect(info?.targetCharacterId).toBe(100)
    })

    it('falls back to the side neighbour, then the remaining tile', () => {
      placeOnTile(grid, 23, CASTER, Team.ALLY)
      placeOnTile(grid, 20, 101, Team.ALLY)
      placeOnTile(grid, 19, 102, Team.ALLY)
      expect(
        findAdjacentPriorityTarget(makeSkillContext(grid, 23, Team.ALLY, CASTER))?.targetHexId,
      ).toBe(20)

      const only19 = new Grid()
      placeOnTile(only19, 23, CASTER, Team.ALLY)
      placeOnTile(only19, 19, 102, Team.ALLY)
      expect(
        findAdjacentPriorityTarget(makeSkillContext(only19, 23, Team.ALLY, CASTER))?.targetHexId,
      ).toBe(19)
    })

    it('mirrors for the enemy team (hex 23: priority 30 > 26 > 27)', () => {
      placeOnTile(grid, 23, CASTER, Team.ENEMY)
      placeOnTile(grid, 26, 200, Team.ENEMY)
      placeOnTile(grid, 27, 201, Team.ENEMY)
      expect(
        findAdjacentPriorityTarget(makeSkillContext(grid, 23, Team.ENEMY, CASTER))?.targetHexId,
      ).toBe(26)
    })

    it('ignores enemy units on candidate tiles', () => {
      placeOnTile(grid, 23, CASTER, Team.ALLY)
      placeOnTile(grid, 16, 200, Team.ENEMY)
      placeOnTile(grid, 19, 102, Team.ALLY)
      expect(
        findAdjacentPriorityTarget(makeSkillContext(grid, 23, Team.ALLY, CASTER))?.targetHexId,
      ).toBe(19)
    })

    // Hex 4's straight-behind tile is off the board (the back row only has
    // hexes 1 and 3), so the left neighbour outranks the bottom-right one.
    it('skips the off-board behind tile: left neighbour over the diagonal at hex 4', () => {
      placeOnTile(grid, 4, CASTER, Team.ALLY)
      placeOnTile(grid, 2, 100, Team.ALLY)
      placeOnTile(grid, 1, 101, Team.ALLY)
      expect(
        findAdjacentPriorityTarget(makeSkillContext(grid, 4, Team.ALLY, CASTER))?.targetHexId,
      ).toBe(2)

      const onlyDiagonal = new Grid()
      placeOnTile(onlyDiagonal, 4, CASTER, Team.ALLY)
      placeOnTile(onlyDiagonal, 1, 101, Team.ALLY)
      expect(
        findAdjacentPriorityTarget(makeSkillContext(onlyDiagonal, 4, Team.ALLY, CASTER))
          ?.targetHexId,
      ).toBe(1)
    })
  })

  // Ally on 4: priority 9 (straight ahead) > 6 (right) > 7 (top-left).
  describe('front', () => {
    it('prefers the tile directly in front', () => {
      placeOnTile(grid, 4, CASTER, Team.ALLY)
      placeOnTile(grid, 9, 100, Team.ALLY)
      placeOnTile(grid, 6, 101, Team.ALLY)
      placeOnTile(grid, 7, 102, Team.ALLY)
      expect(
        findAdjacentPriorityTarget(makeSkillContext(grid, 4, Team.ALLY, CASTER), 'front')
          ?.targetHexId,
      ).toBe(9)
    })

    it('mirrors for the enemy team (hex 42: priority 37 > 40 > 39)', () => {
      placeOnTile(grid, 42, CASTER, Team.ENEMY)
      placeOnTile(grid, 40, 200, Team.ENEMY)
      placeOnTile(grid, 39, 201, Team.ENEMY)
      expect(
        findAdjacentPriorityTarget(makeSkillContext(grid, 42, Team.ENEMY, CASTER), 'front')
          ?.targetHexId,
      ).toBe(40)
    })
  })
})

import { beforeEach, describe, expect, it } from 'vitest'

import { Grid } from '@/lib/grid'
import type { SkillContext } from '@/lib/skills/skill'
import {
  findFrontmostTarget,
  findRearmostTarget,
  findTarget,
  TargetingMethod,
} from '@/lib/skills/utils/distance'
import { Team } from '@/lib/types/team'
import { TARGETING_ARENA, TARGETING_GRID } from '../../fixtures/grid'
import { makeSkillContext, placeOnTile, removeFromTile } from '../../fixtures/skills'

// Key distances on TARGETING_GRID used by the assertions below:
// from hex 1 → hex 11 = 2, hex 10 = 3, hex 2 = 1
// from hex 5 → hex 10 = 1, hex 11 = 2
// from hex 7 → hex 5 = hex 9 = 2 (a true tie)
describe('distance targeting', () => {
  let grid: Grid

  beforeEach(() => {
    grid = new Grid(TARGETING_GRID, TARGETING_ARENA)
  })

  describe('findTarget', () => {
    let context: SkillContext

    beforeEach(() => {
      placeOnTile(grid, 1, 100, Team.ALLY)
      placeOnTile(grid, 10, 200, Team.ENEMY)
      placeOnTile(grid, 11, 201, Team.ENEMY)
      context = makeSkillContext(grid, 1, Team.ALLY, 100)
    })

    it('finds furthest target', () => {
      const result = findTarget(context, {
        targetTeam: Team.ENEMY,
        targetingMethod: TargetingMethod.FURTHEST,
      })

      expect(result?.targetHexId).toBe(10)
      expect(result?.targetCharacterId).toBe(200)
      expect(result?.metadata?.distance).toBe(3)
    })

    it('excludes self when specified', () => {
      // The caster is the only ally, so it is the target unless excluded.
      const options = { targetTeam: Team.ALLY, targetingMethod: TargetingMethod.FURTHEST }

      expect(findTarget(context, options)?.targetHexId).toBe(1)
      expect(findTarget(context, { ...options, excludeSelf: true })).toBeNull()
    })

    it('measures from the reference hex when provided', () => {
      // From hex 1 the furthest enemy is 10; from reference hex 5 it is 11
      const result = findTarget(context, {
        targetTeam: Team.ENEMY,
        targetingMethod: TargetingMethod.FURTHEST,
        referenceHexId: 5,
      })

      expect(result?.targetHexId).toBe(11)
      expect(result?.metadata?.sourceHexId).toBe(1)
    })

    it('forwards excludeSelf to the REARMOST dispatch', () => {
      // Self sits on the rearmost ally tile, so without forwarding the
      // result would be hex 1
      placeOnTile(grid, 2, 102, Team.ALLY)
      placeOnTile(grid, 3, 103, Team.ALLY)

      const result = findTarget(context, {
        targetTeam: Team.ALLY,
        targetingMethod: TargetingMethod.REARMOST,
        excludeSelf: true,
      })

      expect(result?.targetHexId).toBe(2)
      expect(result?.targetCharacterId).toBe(102)
    })
  })

  describe('distance tie-breaking', () => {
    beforeEach(() => {
      // Hexes 5 and 9 are both distance 2 from hex 7
      placeOnTile(grid, 5, 101, Team.ALLY)
      placeOnTile(grid, 9, 102, Team.ALLY)
    })

    it('breaks ties toward the lower hex ID for ally casters', () => {
      const context = makeSkillContext(grid, 7, Team.ALLY, 300)

      const result = findTarget(context, {
        targetTeam: Team.ALLY,
        targetingMethod: TargetingMethod.FURTHEST,
      })

      expect(result?.targetHexId).toBe(5)
      expect(result?.metadata?.distance).toBe(2)
    })

    it('breaks ties toward the higher hex ID for enemy casters', () => {
      const context = makeSkillContext(grid, 7, Team.ENEMY, 300)

      const result = findTarget(context, {
        targetTeam: Team.ALLY,
        targetingMethod: TargetingMethod.FURTHEST,
      })

      expect(result?.targetHexId).toBe(9)
      expect(result?.metadata?.distance).toBe(2)
    })
  })

  describe('findRearmostTarget', () => {
    beforeEach(() => {
      placeOnTile(grid, 1, 100, Team.ALLY)
      placeOnTile(grid, 3, 101, Team.ALLY)
      placeOnTile(grid, 11, 200, Team.ENEMY)
      placeOnTile(grid, 13, 201, Team.ENEMY)
    })

    it('finds rearmost enemy (largest hex ID) when targeting enemies', () => {
      const context = makeSkillContext(grid, 1, Team.ALLY, 100)

      const result = findRearmostTarget(context, Team.ENEMY)

      expect(result?.targetHexId).toBe(13)
      expect(result?.metadata?.isRearmostTarget).toBe(true)
    })

    it('finds rearmost ally (smallest hex ID) when targeting allies', () => {
      const context = makeSkillContext(grid, 11, Team.ENEMY, 200)

      const result = findRearmostTarget(context, Team.ALLY)

      expect(result?.targetHexId).toBe(1)
      expect(result?.metadata?.isRearmostTarget).toBe(true)
    })
  })

  describe('findFrontmostTarget', () => {
    beforeEach(() => {
      placeOnTile(grid, 1, 100, Team.ALLY)
      placeOnTile(grid, 3, 101, Team.ALLY)
      placeOnTile(grid, 11, 200, Team.ENEMY)
      placeOnTile(grid, 13, 201, Team.ENEMY)
    })

    // The scan direction depends on the target team, not the caster team:
    // allies are scanned from the largest hex ID, enemies from the smallest.
    it('finds frontmost ally (largest hex ID) regardless of caster team', () => {
      const sameTeam = findFrontmostTarget(makeSkillContext(grid, 1, Team.ALLY, 100), Team.ALLY)
      expect(sameTeam?.targetHexId).toBe(3)
      expect(sameTeam?.targetCharacterId).toBe(101)
      expect(sameTeam?.metadata?.isFrontmostTarget).toBe(true)

      const crossTeam = findFrontmostTarget(makeSkillContext(grid, 11, Team.ENEMY, 200), Team.ALLY)
      expect(crossTeam?.targetHexId).toBe(3)
      expect(crossTeam?.targetCharacterId).toBe(101)
    })

    it('finds frontmost enemy (smallest hex ID) regardless of caster team', () => {
      const sameTeam = findFrontmostTarget(makeSkillContext(grid, 13, Team.ENEMY, 201), Team.ENEMY)
      expect(sameTeam?.targetHexId).toBe(11)
      expect(sameTeam?.targetCharacterId).toBe(200)
      expect(sameTeam?.metadata?.isFrontmostTarget).toBe(true)

      const crossTeam = findFrontmostTarget(makeSkillContext(grid, 1, Team.ALLY, 100), Team.ENEMY)
      expect(crossTeam?.targetHexId).toBe(11)
      expect(crossTeam?.targetCharacterId).toBe(200)
      expect(crossTeam?.metadata?.examinedTiles).toContain(11)
      expect(crossTeam?.metadata?.examinedTiles).toContain(13)
    })

    it('excludes self when targeting same team', () => {
      removeFromTile(grid, 3)

      const context = makeSkillContext(grid, 1, Team.ALLY, 100)

      expect(findFrontmostTarget(context, Team.ALLY)).toBeNull()
    })
  })
})

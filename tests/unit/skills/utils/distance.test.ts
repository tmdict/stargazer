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
import { makeSkillContext, placeOnTile } from '../../fixtures/skills'

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

    it('finds closest target', () => {
      const result = findTarget(context, {
        targetTeam: Team.ENEMY,
        targetingMethod: TargetingMethod.CLOSEST,
      })

      expect(result?.targetHexId).toBe(11)
      expect(result?.targetCharacterId).toBe(201)
      expect(result?.metadata?.distance).toBe(2)
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
      placeOnTile(grid, 2, 102, Team.ALLY)

      const result = findTarget(context, {
        targetTeam: Team.ALLY,
        targetingMethod: TargetingMethod.CLOSEST,
        excludeSelf: true,
      })

      expect(result?.targetHexId).toBe(2)
      expect(result?.targetCharacterId).toBe(102)
    })

    it('measures from the reference hex when provided', () => {
      // From hex 1 the closest enemy is 11; from reference hex 5 it is 10
      const result = findTarget(context, {
        targetTeam: Team.ENEMY,
        targetingMethod: TargetingMethod.CLOSEST,
        referenceHexId: 5,
      })

      expect(result?.targetHexId).toBe(10)
      expect(result?.metadata?.sourceHexId).toBe(1)
    })

    it('returns null when no targets exist', () => {
      grid.getTileById(10).characterId = undefined
      grid.getTileById(11).characterId = undefined

      const result = findTarget(context, {
        targetTeam: Team.ENEMY,
        targetingMethod: TargetingMethod.CLOSEST,
      })

      expect(result).toBeNull()
    })

    it('finds rearmost target using REARMOST method', () => {
      placeOnTile(grid, 13, 202, Team.ENEMY)

      const result = findTarget(context, {
        targetTeam: Team.ENEMY,
        targetingMethod: TargetingMethod.REARMOST,
      })

      expect(result?.targetHexId).toBe(13)
      expect(result?.metadata?.isRearmostTarget).toBe(true)
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

    it('finds frontmost target using FRONTMOST method', () => {
      placeOnTile(grid, 13, 202, Team.ENEMY)

      const result = findTarget(context, {
        targetTeam: Team.ENEMY,
        targetingMethod: TargetingMethod.FRONTMOST,
      })

      expect(result?.targetHexId).toBe(10)
      expect(result?.metadata?.isFrontmostTarget).toBe(true)
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
        targetingMethod: TargetingMethod.CLOSEST,
      })

      expect(result?.targetHexId).toBe(5)
      expect(result?.metadata?.distance).toBe(2)
    })

    it('breaks ties toward the higher hex ID for enemy casters', () => {
      const context = makeSkillContext(grid, 7, Team.ENEMY, 300)

      const result = findTarget(context, {
        targetTeam: Team.ALLY,
        targetingMethod: TargetingMethod.CLOSEST,
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

    it('returns null when no targets exist', () => {
      const context = makeSkillContext(grid, 1, Team.ALLY, 100)

      grid.getTileById(11).characterId = undefined
      grid.getTileById(13).characterId = undefined

      expect(findRearmostTarget(context, Team.ENEMY)).toBeNull()
    })

    it('excludes self when excludeSelf is true and targeting same team', () => {
      placeOnTile(grid, 2, 102, Team.ALLY)
      placeOnTile(grid, 4, 104, Team.ALLY)
      placeOnTile(grid, 5, 105, Team.ALLY)

      const allyContext = makeSkillContext(grid, 4, Team.ALLY, 104)

      const resultWithoutExclusion = findRearmostTarget(allyContext, Team.ALLY, false)
      expect(resultWithoutExclusion?.targetHexId).toBe(1)
      expect(resultWithoutExclusion?.targetCharacterId).toBe(100)
      expect(resultWithoutExclusion?.metadata?.sourceHexId).toBe(4)
      expect(resultWithoutExclusion?.metadata?.isRearmostTarget).toBe(true)
      expect(resultWithoutExclusion?.metadata?.examinedTiles).toContain(1)
      expect(resultWithoutExclusion?.metadata?.examinedTiles).toContain(3)

      const resultWithExclusion = findRearmostTarget(allyContext, Team.ALLY, true)
      expect(resultWithExclusion?.targetHexId).toBe(1)
      expect(resultWithExclusion?.targetCharacterId).toBe(100)

      // Self on the rearmost tile: exclusion shifts the target to the next hex
      const rearmostContext = makeSkillContext(grid, 1, Team.ALLY, 100)
      const resultWithSelfAtRear = findRearmostTarget(rearmostContext, Team.ALLY, true)
      expect(resultWithSelfAtRear?.targetHexId).toBe(2)
      expect(resultWithSelfAtRear?.targetCharacterId).toBe(102)
    })

    it('does not exclude self when targeting different team even with excludeSelf true', () => {
      const context = makeSkillContext(grid, 3, Team.ALLY, 101)

      const result = findRearmostTarget(context, Team.ENEMY, true)
      expect(result?.targetHexId).toBe(13)
      expect(result?.targetCharacterId).toBe(201)
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
      grid.getTileById(3).characterId = undefined
      grid.getTileById(3).team = undefined

      const context = makeSkillContext(grid, 1, Team.ALLY, 100)

      expect(findFrontmostTarget(context, Team.ALLY)).toBeNull()
    })

    it('returns null when no targets exist', () => {
      const context = makeSkillContext(grid, 1, Team.ALLY, 100)

      grid.getTileById(11).characterId = undefined
      grid.getTileById(13).characterId = undefined

      expect(findFrontmostTarget(context, Team.ENEMY)).toBeNull()
    })
  })
})

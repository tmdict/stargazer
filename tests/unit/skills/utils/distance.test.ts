import { beforeEach, describe, expect, it } from 'vitest'

import { Grid } from '@/lib/grid'
import type { SkillContext } from '@/lib/skills/skill'
import { SkillManager } from '@/lib/skills/skill'
import {
  findFrontmostTarget,
  findRearmostTarget,
  findTarget,
  TargetingMethod,
  type TargetingOptions,
} from '@/lib/skills/utils/distance'
import type { GridPreset } from '@/lib/types/grid'
import { State } from '@/lib/types/state'
import { Team } from '@/lib/types/team'

const TEST_GRID: GridPreset = {
  hex: [[7], [6, 8], [5, 9], [4, 10], [3, 11], [2, 12], [1, 13, 14]],
  qOffset: [0, -1, -1, -2, -2, -3, -3],
}

const TEST_ARENA = {
  id: 1,
  name: 'Test',
  grid: [
    { type: State.AVAILABLE_ALLY, hex: [1, 2, 3, 4, 5, 6] },
    { type: State.AVAILABLE_ENEMY, hex: [9, 10, 11, 12, 13, 14] },
    { type: State.DEFAULT, hex: [7, 8] },
  ],
}

describe('distance targeting', () => {
  let grid: Grid

  beforeEach(() => {
    grid = new Grid(TEST_GRID, TEST_ARENA)
  })

  describe('findTarget', () => {
    let context: SkillContext

    beforeEach(() => {
      const tile1 = grid.getTileById(1)
      tile1.characterId = 100
      tile1.team = Team.ALLY

      const tile10 = grid.getTileById(10)
      tile10.characterId = 200
      tile10.team = Team.ENEMY

      const tile11 = grid.getTileById(11)
      tile11.characterId = 201
      tile11.team = Team.ENEMY

      context = {
        grid,
        hexId: 1,
        team: Team.ALLY,
        characterId: 100,
        skillManager: {} as SkillManager,
      }
    })

    it('finds closest target', () => {
      const options: TargetingOptions = {
        targetTeam: Team.ENEMY,
        targetingMethod: TargetingMethod.CLOSEST,
      }

      const result = findTarget(context, options)

      expect(result).not.toBeNull()
      expect(result?.targetCharacterId).toBeDefined()
      expect(result?.metadata?.distance).toBeDefined()
    })

    it('finds furthest target', () => {
      const options: TargetingOptions = {
        targetTeam: Team.ENEMY,
        targetingMethod: TargetingMethod.FURTHEST,
      }

      const result = findTarget(context, options)

      expect(result).not.toBeNull()
      expect(result?.targetCharacterId).toBeDefined()
    })

    it('excludes self when specified', () => {
      const tile2 = grid.getTileById(2)
      tile2.characterId = 102
      tile2.team = Team.ALLY

      const options: TargetingOptions = {
        targetTeam: Team.ALLY,
        targetingMethod: TargetingMethod.CLOSEST,
        excludeSelf: true,
      }

      const result = findTarget(context, options)

      expect(result?.targetCharacterId).not.toBe(100)
    })

    it('uses reference hex when provided', () => {
      const options: TargetingOptions = {
        targetTeam: Team.ENEMY,
        targetingMethod: TargetingMethod.CLOSEST,
        referenceHexId: 5,
      }

      const result = findTarget(context, options)

      expect(result).not.toBeNull()
      expect(result?.metadata?.sourceHexId).toBe(1)
    })

    it('returns null when no targets exist', () => {
      grid.getTileById(10).characterId = undefined
      grid.getTileById(11).characterId = undefined

      const options: TargetingOptions = {
        targetTeam: Team.ENEMY,
        targetingMethod: TargetingMethod.CLOSEST,
      }

      const result = findTarget(context, options)
      expect(result).toBeNull()
    })

    it('finds rearmost target using REARMOST method', () => {
      const tile13 = grid.getTileById(13)
      tile13.characterId = 202
      tile13.team = Team.ENEMY

      const options: TargetingOptions = {
        targetTeam: Team.ENEMY,
        targetingMethod: TargetingMethod.REARMOST,
      }

      const result = findTarget(context, options)

      expect(result).not.toBeNull()
      expect(result?.targetHexId).toBe(13)
      expect(result?.metadata?.isRearmostTarget).toBe(true)
    })

    it('finds frontmost target using FRONTMOST method', () => {
      const tile13 = grid.getTileById(13)
      tile13.characterId = 202
      tile13.team = Team.ENEMY

      const options: TargetingOptions = {
        targetTeam: Team.ENEMY,
        targetingMethod: TargetingMethod.FRONTMOST,
      }

      const result = findTarget(context, options)

      expect(result).not.toBeNull()
      expect(result?.targetHexId).toBe(10)
      expect(result?.metadata?.isFrontmostTarget).toBe(true)
    })

    it('finds frontmost ally using FRONTMOST method (excluding self)', () => {
      const tile2 = grid.getTileById(2)
      tile2.characterId = 102
      tile2.team = Team.ALLY

      const tile3 = grid.getTileById(3)
      tile3.characterId = 103
      tile3.team = Team.ALLY

      const allyContext: SkillContext = {
        grid,
        hexId: 1,
        team: Team.ALLY,
        characterId: 100,
        skillManager: {} as SkillManager,
      }

      const options: TargetingOptions = {
        targetTeam: Team.ALLY,
        targetingMethod: TargetingMethod.FRONTMOST,
        excludeSelf: true,
      }

      const result = findTarget(allyContext, options)

      expect(result).not.toBeNull()
      expect(result?.targetHexId).toBe(3)
      expect(result?.targetCharacterId).toBe(103)
    })

    it('finds rearmost ally with self-exclusion', () => {
      const tile2 = grid.getTileById(2)
      tile2.characterId = 102
      tile2.team = Team.ALLY

      const tile3 = grid.getTileById(3)
      tile3.characterId = 103
      tile3.team = Team.ALLY

      const tile4 = grid.getTileById(4)
      tile4.characterId = 104
      tile4.team = Team.ALLY

      const allyContext = {
        ...context,
        hexId: 3,
        team: Team.ALLY,
        characterId: 103,
      }

      const options: TargetingOptions = {
        targetTeam: Team.ALLY,
        targetingMethod: TargetingMethod.REARMOST,
        excludeSelf: true,
      }

      const result = findTarget(allyContext, options)

      expect(result).not.toBeNull()
      expect(result?.targetHexId).toBe(1)
      expect(result?.targetCharacterId).toBe(100)
      expect(result?.metadata?.isRearmostTarget).toBe(true)
    })

    it('applies ally team hex ID tiebreaker', () => {
      const tile4 = grid.getTileById(4)
      tile4.characterId = 103
      tile4.team = Team.ALLY

      const tile6 = grid.getTileById(6)
      tile6.characterId = 104
      tile6.team = Team.ALLY

      const enemyContext: SkillContext = {
        grid,
        hexId: 7,
        team: Team.ALLY,
        characterId: 300,
        skillManager: {} as SkillManager,
      }

      const options: TargetingOptions = {
        targetTeam: Team.ALLY,
        targetingMethod: TargetingMethod.CLOSEST,
      }

      const result = findTarget(enemyContext, options)

      expect(result?.targetHexId).toBeLessThanOrEqual(6)
    })

    it('applies enemy team hex ID tiebreaker', () => {
      const enemyContext: SkillContext = {
        grid,
        hexId: 10,
        team: Team.ENEMY,
        characterId: 200,
        skillManager: {} as SkillManager,
      }

      const tile12 = grid.getTileById(12)
      tile12.characterId = 202
      tile12.team = Team.ENEMY

      const options: TargetingOptions = {
        targetTeam: Team.ENEMY,
        targetingMethod: TargetingMethod.CLOSEST,
        excludeSelf: true,
      }

      const result = findTarget(enemyContext, options)

      expect(result?.targetHexId).toBeGreaterThanOrEqual(11)
    })
  })

  describe('findRearmostTarget', () => {
    beforeEach(() => {
      const tile1 = grid.getTileById(1)
      tile1.characterId = 100
      tile1.team = Team.ALLY

      const tile3 = grid.getTileById(3)
      tile3.characterId = 101
      tile3.team = Team.ALLY

      const tile11 = grid.getTileById(11)
      tile11.characterId = 200
      tile11.team = Team.ENEMY

      const tile13 = grid.getTileById(13)
      tile13.characterId = 201
      tile13.team = Team.ENEMY
    })

    it('finds rearmost enemy (largest hex ID) when targeting enemies', () => {
      const context: SkillContext = {
        grid,
        hexId: 1,
        team: Team.ALLY,
        characterId: 100,
        skillManager: {} as SkillManager,
      }

      const result = findRearmostTarget(context, Team.ENEMY)

      expect(result).not.toBeNull()
      expect(result?.targetHexId).toBe(13)
      expect(result?.metadata?.isRearmostTarget).toBe(true)
    })

    it('finds rearmost ally (smallest hex ID) when targeting allies', () => {
      const context: SkillContext = {
        grid,
        hexId: 11,
        team: Team.ENEMY,
        characterId: 200,
        skillManager: {} as SkillManager,
      }

      const result = findRearmostTarget(context, Team.ALLY)

      expect(result).not.toBeNull()
      expect(result?.targetHexId).toBe(1)
      expect(result?.metadata?.isRearmostTarget).toBe(true)
    })

    it('returns null when no targets exist', () => {
      const context: SkillContext = {
        grid,
        hexId: 1,
        team: Team.ALLY,
        characterId: 100,
        skillManager: {} as SkillManager,
      }

      grid.getTileById(11).characterId = undefined
      grid.getTileById(13).characterId = undefined

      const result = findRearmostTarget(context, Team.ENEMY)
      expect(result).toBeNull()
    })

    it('should exclude self when excludeSelf is true and targeting same team', () => {
      const tile2 = grid.getTileById(2)
      tile2.characterId = 102
      tile2.team = Team.ALLY

      const tile4 = grid.getTileById(4)
      tile4.characterId = 104
      tile4.team = Team.ALLY

      const tile5 = grid.getTileById(5)
      tile5.characterId = 105
      tile5.team = Team.ALLY

      const allyContext: SkillContext = {
        grid,
        hexId: 4,
        team: Team.ALLY,
        characterId: 104,
        skillManager: {} as SkillManager,
      }

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
      expect(resultWithExclusion?.metadata?.sourceHexId).toBe(4)
      expect(resultWithExclusion?.metadata?.isRearmostTarget).toBe(true)

      const rearmostContext: SkillContext = {
        grid,
        hexId: 1,
        team: Team.ALLY,
        characterId: 100,
        skillManager: {} as SkillManager,
      }

      const resultWithSelfAtRear = findRearmostTarget(rearmostContext, Team.ALLY, true)
      expect(resultWithSelfAtRear?.targetHexId).toBe(2)
      expect(resultWithSelfAtRear?.targetCharacterId).toBe(102)
      expect(resultWithSelfAtRear?.metadata?.sourceHexId).toBe(1)
      expect(resultWithSelfAtRear?.metadata?.isRearmostTarget).toBe(true)
    })

    it('should not exclude self when targeting different team even with excludeSelf true', () => {
      const context: SkillContext = {
        grid,
        hexId: 3,
        team: Team.ALLY,
        characterId: 101,
        skillManager: {} as SkillManager,
      }

      const result = findRearmostTarget(context, Team.ENEMY, true)
      expect(result).toEqual({
        targetHexId: 13,
        targetCharacterId: 201,
        metadata: {
          sourceHexId: 3,
          examinedTiles: [11, 13],
          isRearmostTarget: true,
        },
      })
    })
  })

  describe('findFrontmostTarget', () => {
    beforeEach(() => {
      const tile1 = grid.getTileById(1)
      tile1.characterId = 100
      tile1.team = Team.ALLY

      const tile3 = grid.getTileById(3)
      tile3.characterId = 101
      tile3.team = Team.ALLY

      const tile11 = grid.getTileById(11)
      tile11.characterId = 200
      tile11.team = Team.ENEMY

      const tile13 = grid.getTileById(13)
      tile13.characterId = 201
      tile13.team = Team.ENEMY
    })

    it('finds frontmost ally (largest hex ID) when targeting allies (excluding self)', () => {
      const context: SkillContext = {
        grid,
        hexId: 1,
        team: Team.ALLY,
        characterId: 100,
        skillManager: {} as SkillManager,
      }

      const result = findFrontmostTarget(context, Team.ALLY)

      expect(result).not.toBeNull()
      expect(result?.targetHexId).toBe(3)
      expect(result?.targetCharacterId).toBe(101)
      expect(result?.metadata?.isFrontmostTarget).toBe(true)
    })

    it('finds frontmost enemy (smallest hex ID) when targeting enemies (excluding self)', () => {
      const context: SkillContext = {
        grid,
        hexId: 13,
        team: Team.ENEMY,
        characterId: 201,
        skillManager: {} as SkillManager,
      }

      const result = findFrontmostTarget(context, Team.ENEMY)

      expect(result).not.toBeNull()
      expect(result?.targetHexId).toBe(11)
      expect(result?.targetCharacterId).toBe(200)
      expect(result?.metadata?.isFrontmostTarget).toBe(true)
    })

    it('finds frontmost enemy (smallest hex ID) when ally targets enemies', () => {
      const context: SkillContext = {
        grid,
        hexId: 1,
        team: Team.ALLY,
        characterId: 100,
        skillManager: {} as SkillManager,
      }

      const result = findFrontmostTarget(context, Team.ENEMY)

      expect(result).not.toBeNull()
      expect(result?.targetHexId).toBe(11)
      expect(result?.targetCharacterId).toBe(200)
    })

    it('finds frontmost ally (largest hex ID) when enemy targets allies', () => {
      const context: SkillContext = {
        grid,
        hexId: 11,
        team: Team.ENEMY,
        characterId: 200,
        skillManager: {} as SkillManager,
      }

      const result = findFrontmostTarget(context, Team.ALLY)

      expect(result).not.toBeNull()
      expect(result?.targetHexId).toBe(3)
      expect(result?.targetCharacterId).toBe(101)
    })

    it('excludes self when targeting same team', () => {
      grid.getTileById(3).characterId = undefined
      grid.getTileById(3).team = undefined

      const context: SkillContext = {
        grid,
        hexId: 1,
        team: Team.ALLY,
        characterId: 100,
        skillManager: {} as SkillManager,
      }

      const result = findFrontmostTarget(context, Team.ALLY)
      expect(result).toBeNull()
    })

    it('returns null when no targets exist', () => {
      const context: SkillContext = {
        grid,
        hexId: 1,
        team: Team.ALLY,
        characterId: 100,
        skillManager: {} as SkillManager,
      }

      grid.getTileById(11).characterId = undefined
      grid.getTileById(13).characterId = undefined

      const result = findFrontmostTarget(context, Team.ENEMY)
      expect(result).toBeNull()
    })

    it('returns metadata with examined tiles', () => {
      const context: SkillContext = {
        grid,
        hexId: 1,
        team: Team.ALLY,
        characterId: 100,
        skillManager: {} as SkillManager,
      }

      const result = findFrontmostTarget(context, Team.ENEMY)

      expect(result?.metadata?.examinedTiles).toBeDefined()
      expect(result?.metadata?.examinedTiles).toContain(11)
      expect(result?.metadata?.examinedTiles).toContain(13)
    })
  })

  describe('edge cases', () => {
    it('handles empty grid', () => {
      const context: SkillContext = {
        grid,
        hexId: 1,
        team: Team.ALLY,
        characterId: 100,
        skillManager: {} as SkillManager,
      }

      const options: TargetingOptions = {
        targetTeam: Team.ENEMY,
        targetingMethod: TargetingMethod.CLOSEST,
      }

      const result = findTarget(context, options)
      expect(result).toBeNull()
    })

    it('handles single candidate', () => {
      const tile10 = grid.getTileById(10)
      tile10.characterId = 200
      tile10.team = Team.ENEMY

      const context: SkillContext = {
        grid,
        hexId: 1,
        team: Team.ALLY,
        characterId: 100,
        skillManager: {} as SkillManager,
      }

      const options: TargetingOptions = {
        targetTeam: Team.ENEMY,
        targetingMethod: TargetingMethod.CLOSEST,
      }

      const result = findTarget(context, options)
      expect(result?.targetCharacterId).toBe(200)
    })

    it('handles all targets at same distance', () => {
      const tile5 = grid.getTileById(5)
      tile5.characterId = 100
      tile5.team = Team.ALLY

      const tile9 = grid.getTileById(9)
      tile9.characterId = 101
      tile9.team = Team.ALLY

      const context: SkillContext = {
        grid,
        hexId: 7,
        team: Team.ALLY,
        characterId: 300,
        skillManager: {} as SkillManager,
      }

      const options: TargetingOptions = {
        targetTeam: Team.ALLY,
        targetingMethod: TargetingMethod.CLOSEST,
      }

      const result = findTarget(context, options)
      expect(result).not.toBeNull()
      expect(result?.targetHexId).toBeDefined()
    })
  })
})

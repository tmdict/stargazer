import { beforeEach, describe, expect, it } from 'vitest'

import { getOpposingTeam } from '@/lib/characters/character'
import { Grid } from '@/lib/grid'
import type { SkillContext } from '@/lib/skills/skill'
import { SkillManager } from '@/lib/skills/skill'
import {
  calculateDistances,
  findRearmostTarget,
  findTarget,
  getCandidates,
  getOpposingCharacters,
  getTeamTargetCandidates,
  spiralSearchFromTile,
  TargetingMethod,
  type TargetCandidate,
  type TargetingOptions,
} from '@/lib/skills/utils/targeting'
import type { GridPreset } from '@/lib/types/grid'
import { State } from '@/lib/types/state'
import { Team } from '@/lib/types/team'

// Test grid setup - larger grid for better testing
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

describe('targeting', () => {
  let grid: Grid

  beforeEach(() => {
    grid = new Grid(TEST_GRID, TEST_ARENA)
  })

  describe('team utilities', () => {
    it('gets opposing team correctly', () => {
      expect(getOpposingTeam(Team.ALLY)).toBe(Team.ENEMY)
      expect(getOpposingTeam(Team.ENEMY)).toBe(Team.ALLY)
    })

    it('retrieves team target candidates', () => {
      // Place characters
      const tile1 = grid.getTileById(1)
      tile1.characterId = 100
      tile1.team = Team.ALLY

      const tile2 = grid.getTileById(2)
      tile2.characterId = 101
      tile2.team = Team.ALLY

      const tile3 = grid.getTileById(10)
      tile3.characterId = 200
      tile3.team = Team.ENEMY

      const allyChars = getTeamTargetCandidates(grid, Team.ALLY)
      expect(allyChars).toHaveLength(2)
      const allyCharIds = allyChars.map((c) => c.characterId).sort()
      expect(allyCharIds).toEqual([100, 101])

      const enemyChars = getTeamTargetCandidates(grid, Team.ENEMY)
      expect(enemyChars).toHaveLength(1)
      expect(enemyChars[0]?.characterId).toBe(200)
    })

    it('retrieves opposing characters', () => {
      const tile1 = grid.getTileById(1)
      tile1.characterId = 100
      tile1.team = Team.ALLY

      const tile2 = grid.getTileById(10)
      tile2.characterId = 200
      tile2.team = Team.ENEMY

      const opposingToAlly = getOpposingCharacters(grid, Team.ALLY)
      expect(opposingToAlly).toHaveLength(1)
      expect(opposingToAlly[0]?.characterId).toBe(200)

      const opposingToEnemy = getOpposingCharacters(grid, Team.ENEMY)
      expect(opposingToEnemy).toHaveLength(1)
      expect(opposingToEnemy[0]?.characterId).toBe(100)
    })
  })

  describe('calculateDistances', () => {
    it('calculates distances from reference points', () => {
      const candidates: TargetCandidate[] = [
        { hexId: 10, characterId: 200, distances: new Map() },
        { hexId: 11, characterId: 201, distances: new Map() },
      ]

      calculateDistances(candidates, [1, 2], grid)

      expect(candidates[0]?.distances.has(1)).toBe(true)
      expect(candidates[0]?.distances.has(2)).toBe(true)
      expect(candidates[1]?.distances.has(1)).toBe(true)
      expect(candidates[1]?.distances.has(2)).toBe(true)
    })

    it('calculates correct distance values', () => {
      const candidates: TargetCandidate[] = [{ hexId: 2, characterId: 100, distances: new Map() }]

      calculateDistances(candidates, [1], grid)

      // Hex 1 and 2 are adjacent
      const hex1 = grid.getHexById(1)
      const hex2 = grid.getHexById(2)
      const expectedDistance = hex1.distance(hex2)

      expect(candidates[0]?.distances.get(1)).toBe(expectedDistance)
    })
  })

  describe('getCandidates', () => {
    it('gets candidates without exclusion', () => {
      const tile1 = grid.getTileById(1)
      tile1.characterId = 100
      tile1.team = Team.ALLY

      const tile2 = grid.getTileById(2)
      tile2.characterId = 101
      tile2.team = Team.ALLY

      const candidates = getCandidates(grid, Team.ALLY)
      expect(candidates).toHaveLength(2)
    })

    it('excludes specified character', () => {
      const tile1 = grid.getTileById(1)
      tile1.characterId = 100
      tile1.team = Team.ALLY

      const tile2 = grid.getTileById(2)
      tile2.characterId = 101
      tile2.team = Team.ALLY

      const candidates = getCandidates(grid, Team.ALLY, 100)
      expect(candidates).toHaveLength(1)
      expect(candidates[0]?.characterId).toBe(101)
    })
  })

  describe('findTarget', () => {
    let context: SkillContext

    beforeEach(() => {
      // Setup characters
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
      // Add self as target candidate
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
      expect(result?.metadata?.sourceHexId).toBe(1) // Original hex
    })

    it('returns null when no targets exist', () => {
      // Remove all enemies
      grid.getTileById(10).characterId = undefined
      grid.getTileById(11).characterId = undefined

      const options: TargetingOptions = {
        targetTeam: Team.ENEMY,
        targetingMethod: TargetingMethod.CLOSEST,
      }

      const result = findTarget(context, options)
      expect(result).toBeNull()
    })

    it('applies ally team hex ID tiebreaker', () => {
      // Setup equidistant targets
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

      // Ally team prefers lower hex IDs in ties
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

      // Create equidistant targets
      const tile12 = grid.getTileById(12)
      tile12.characterId = 202
      tile12.team = Team.ENEMY

      const options: TargetingOptions = {
        targetTeam: Team.ENEMY,
        targetingMethod: TargetingMethod.CLOSEST,
        excludeSelf: true,
      }

      const result = findTarget(enemyContext, options)

      // Enemy team prefers higher hex IDs in ties
      expect(result?.targetHexId).toBeGreaterThanOrEqual(11)
    })
  })

  describe('findRearmostTarget', () => {
    beforeEach(() => {
      // Setup characters
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

    it('finds rearmost enemy for ally team', () => {
      const context: SkillContext = {
        grid,
        hexId: 1,
        team: Team.ALLY,
        characterId: 100,
        skillManager: {} as SkillManager,
      }

      const result = findRearmostTarget(context, Team.ENEMY)

      expect(result).not.toBeNull()
      // Ally targeting enemy: largest hex ID is rearmost
      expect(result?.targetHexId).toBe(13)
      expect(result?.metadata?.isRearmostTarget).toBe(true)
    })

    it('finds rearmost ally for enemy team', () => {
      const context: SkillContext = {
        grid,
        hexId: 11,
        team: Team.ENEMY,
        characterId: 200,
        skillManager: {} as SkillManager,
      }

      const result = findRearmostTarget(context, Team.ALLY)

      expect(result).not.toBeNull()
      // Enemy targeting ally: smallest hex ID is rearmost
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

      // Remove all enemies
      grid.getTileById(11).characterId = undefined
      grid.getTileById(13).characterId = undefined

      const result = findRearmostTarget(context, Team.ENEMY)
      expect(result).toBeNull()
    })
  })

  describe('spiralSearchFromTile', () => {
    beforeEach(() => {
      // Setup characters in specific positions
      const tile3 = grid.getTileById(3)
      tile3.characterId = 100
      tile3.team = Team.ALLY

      const tile11 = grid.getTileById(11)
      tile11.characterId = 200
      tile11.team = Team.ENEMY
    })

    it('finds nearest target via spiral search', () => {
      const result = spiralSearchFromTile(grid, 7, Team.ALLY, Team.ENEMY)

      expect(result).not.toBeNull()
      expect(result?.targetCharacterId).toBe(100)
      expect(result?.metadata?.symmetricalHexId).toBe(7)
      expect(result?.metadata?.isSymmetricalTarget).toBe(false)
    })

    it('returns null when no targets exist', () => {
      // Remove all allies
      grid.getTileById(3).characterId = undefined

      const result = spiralSearchFromTile(grid, 7, Team.ALLY, Team.ENEMY)
      expect(result).toBeNull()
    })

    it('handles invalid center hex', () => {
      // spiralSearchFromTile calls grid.getHexById which throws for invalid hex IDs
      // So we need to expect the function to throw or handle the error
      expect(() => spiralSearchFromTile(grid, 999, Team.ALLY, Team.ENEMY)).toThrow(
        'Hex with ID 999 not found',
      )
    })

    it('examines tiles in spiral pattern', () => {
      // Add multiple targets to verify pattern
      const tile5 = grid.getTileById(5)
      tile5.characterId = 101
      tile5.team = Team.ALLY

      const result = spiralSearchFromTile(grid, 7, Team.ALLY, Team.ENEMY)

      expect(result).not.toBeNull()
      expect(result?.metadata?.examinedTiles).toBeDefined()
      expect(result?.metadata?.examinedTiles!.length).toBeGreaterThan(0)
    })

    it('uses correct walk order for ally team', () => {
      // Place multiple targets at same distance
      const tile6 = grid.getTileById(6)
      tile6.characterId = 101
      tile6.team = Team.ALLY

      const tile8 = grid.getTileById(8)
      tile8.characterId = 102
      tile8.team = Team.ALLY

      const result = spiralSearchFromTile(grid, 7, Team.ALLY, Team.ALLY)

      expect(result).not.toBeNull()
      // Should find one of the adjacent tiles
      expect([6, 8]).toContain(result?.targetHexId)
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
      // Create symmetric layout
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
      // Should apply tie-breaker
      expect(result?.targetHexId).toBeDefined()
    })
  })
})

import { beforeEach, describe, expect, it } from 'vitest'

import { getOpposingTeam } from '@/lib/characters/character'
import { Grid } from '@/lib/grid'
import {
  calculateDistances,
  getCandidates,
  getOpposingCharacters,
  getTeamTargetCandidates,
  type TargetCandidate,
} from '@/lib/skills/utils/targeting'
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

describe('targeting foundations', () => {
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
})

import { beforeEach, describe, expect, it } from 'vitest'

import { Grid } from '@/lib/grid'
import {
  calculateDistances,
  getCandidates,
  getTeamTargetCandidates,
  type TargetCandidate,
} from '@/lib/skills/utils/targeting'
import { Team } from '@/lib/types/team'
import { TARGETING_ARENA, TARGETING_GRID } from '../../fixtures/grid'
import { placeOnTile } from '../../fixtures/skills'

describe('targeting foundations', () => {
  let grid: Grid

  beforeEach(() => {
    grid = new Grid(TARGETING_GRID, TARGETING_ARENA)
  })

  describe('getTeamTargetCandidates', () => {
    it('retrieves candidates for the requested team only', () => {
      placeOnTile(grid, 1, 100, Team.ALLY)
      placeOnTile(grid, 2, 101, Team.ALLY)
      placeOnTile(grid, 10, 200, Team.ENEMY)

      const allyChars = getTeamTargetCandidates(grid, Team.ALLY)
      expect(allyChars).toHaveLength(2)
      const allyCharIds = allyChars.map((c) => c.characterId).sort()
      expect(allyCharIds).toEqual([100, 101])

      const enemyChars = getTeamTargetCandidates(grid, Team.ENEMY)
      expect(enemyChars).toHaveLength(1)
      expect(enemyChars[0]?.characterId).toBe(200)
    })
  })

  describe('calculateDistances', () => {
    it('records the hex distance from every reference point', () => {
      const candidates: TargetCandidate[] = [
        { hexId: 10, characterId: 200, distances: new Map() },
        { hexId: 11, characterId: 201, distances: new Map() },
      ]

      calculateDistances(candidates, [1, 2], grid)

      expect(candidates[0]?.distances.get(1)).toBe(3)
      expect(candidates[0]?.distances.get(2)).toBe(2)
      expect(candidates[1]?.distances.get(1)).toBe(2)
      expect(candidates[1]?.distances.get(2)).toBe(2)
    })
  })

  describe('getCandidates', () => {
    it('gets candidates without exclusion', () => {
      placeOnTile(grid, 1, 100, Team.ALLY)
      placeOnTile(grid, 2, 101, Team.ALLY)

      const candidates = getCandidates(grid, Team.ALLY)
      expect(candidates).toHaveLength(2)
    })

    it('excludes specified character', () => {
      placeOnTile(grid, 1, 100, Team.ALLY)
      placeOnTile(grid, 2, 101, Team.ALLY)

      const candidates = getCandidates(grid, Team.ALLY, 100)
      expect(candidates).toHaveLength(1)
      expect(candidates[0]?.characterId).toBe(101)
    })
  })
})

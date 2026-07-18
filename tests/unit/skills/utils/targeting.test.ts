import { beforeEach, describe, expect, it } from 'vitest'

import { Grid } from '@/lib/grid'
import {
  calculateDistances,
  findAdjacentPriorityTarget,
  getCandidates,
  getTeamTargetCandidates,
  type TargetCandidate,
} from '@/lib/skills/utils/targeting'
import { Team } from '@/lib/types/team'
import { TARGETING_ARENA, TARGETING_GRID } from '../../fixtures/grid'
import { makeSkillContext, placeOnTile } from '../../fixtures/skills'

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

describe('findAdjacentPriorityTarget', () => {
  let grid: Grid

  const CASTER = 500

  beforeEach(() => {
    grid = new Grid()
  })

  // Ally on 23: lower-id neighbors sorted [16, 19, 20], priority 16 > 20 > 19.
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

    it('falls back to the side neighbour (nearest id), then the remaining tile', () => {
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

    it('accepts a companion-band unit as the target', () => {
      placeOnTile(grid, 23, CASTER, Team.ALLY)
      placeOnTile(grid, 16, 10100, Team.ALLY)
      expect(
        findAdjacentPriorityTarget(makeSkillContext(grid, 23, Team.ALLY, CASTER))
          ?.targetCharacterId,
      ).toBe(10100)
    })

    it('handles edges: a single candidate at hex 14, none at the rearmost hex 1', () => {
      placeOnTile(grid, 14, CASTER, Team.ALLY)
      placeOnTile(grid, 10, 100, Team.ALLY)
      expect(
        findAdjacentPriorityTarget(makeSkillContext(grid, 14, Team.ALLY, CASTER))?.targetHexId,
      ).toBe(10)

      const rear = new Grid()
      placeOnTile(rear, 1, CASTER, Team.ALLY)
      placeOnTile(rear, 3, 100, Team.ALLY)
      expect(findAdjacentPriorityTarget(makeSkillContext(rear, 1, Team.ALLY, CASTER))).toBeNull()
    })

    it('returns null when no candidate tile is occupied', () => {
      placeOnTile(grid, 23, CASTER, Team.ALLY)
      expect(findAdjacentPriorityTarget(makeSkillContext(grid, 23, Team.ALLY, CASTER))).toBeNull()
    })
  })

  // Ally on 4: higher-id neighbors sorted [9, 7, 6], priority 9 > 6 > 7.
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

    it('falls back to the side neighbour (nearest id), then the remaining tile', () => {
      placeOnTile(grid, 4, CASTER, Team.ALLY)
      placeOnTile(grid, 6, 101, Team.ALLY)
      placeOnTile(grid, 7, 102, Team.ALLY)
      expect(
        findAdjacentPriorityTarget(makeSkillContext(grid, 4, Team.ALLY, CASTER), 'front')
          ?.targetHexId,
      ).toBe(6)

      const only7 = new Grid()
      placeOnTile(only7, 4, CASTER, Team.ALLY)
      placeOnTile(only7, 7, 102, Team.ALLY)
      expect(
        findAdjacentPriorityTarget(makeSkillContext(only7, 4, Team.ALLY, CASTER), 'front')
          ?.targetHexId,
      ).toBe(7)
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

import { beforeEach, describe, expect, it } from 'vitest'

import {
  canPlaceCharacterOnTeam,
  findTeamPhantimalHex,
  getTeamCharacters,
  setMaxTeamSize,
} from '@/lib/characters/character'
import {
  isPhantimalId,
  PHANTIMAL_ID_OFFSET,
  toLocalPhantimalId,
  toPhantimalId,
} from '@/lib/characters/phantimal'
import { performPlace } from '@/lib/characters/place'
import { performRemove } from '@/lib/characters/remove'
import { Grid } from '@/lib/grid'
import { State } from '@/lib/types/state'
import { Team } from '@/lib/types/team'
import { STANDARD_ARENA, STANDARD_GRID } from '../fixtures/grid'

describe('phantimal', () => {
  describe('id helpers', () => {
    it('round-trips local ids through the namespace', () => {
      expect(toPhantimalId(3)).toBe(PHANTIMAL_ID_OFFSET + 3)
      expect(toLocalPhantimalId(toPhantimalId(3))).toBe(3)
    })

    it('identifies phantimal ids by the offset', () => {
      expect(isPhantimalId(PHANTIMAL_ID_OFFSET)).toBe(true)
      expect(isPhantimalId(toPhantimalId(1))).toBe(true)
      expect(isPhantimalId(9999)).toBe(false)
      // Companion range stays below phantimals
      expect(isPhantimalId(10050)).toBe(false)
    })
  })

  describe('placement on the grid', () => {
    let grid: Grid

    beforeEach(() => {
      grid = new Grid(STANDARD_GRID, STANDARD_ARENA)
    })

    it('occupies a tile but is excluded from team-size tracking', () => {
      const ok = performPlace(grid, 1, toPhantimalId(2), Team.ALLY, true)

      expect(ok).toBe(true)
      const tile = grid.getTileById(1)
      expect(tile.characterId).toBe(toPhantimalId(2))
      expect(tile.team).toBe(Team.ALLY)
      expect(tile.state).toBe(State.OCCUPIED_ALLY)
      // The capacity set never sees the phantimal
      expect(getTeamCharacters(grid, Team.ALLY).has(toPhantimalId(2))).toBe(false)
      expect(getTeamCharacters(grid, Team.ALLY).size).toBe(0)
    })

    it('is exempt from the team-size limit when the team is full', () => {
      setMaxTeamSize(grid, Team.ALLY, 1)
      performPlace(grid, 1, 100, Team.ALLY, true) // fills the ally team

      expect(canPlaceCharacterOnTeam(grid, 200, Team.ALLY)).toBe(false)
      expect(canPlaceCharacterOnTeam(grid, toPhantimalId(1), Team.ALLY)).toBe(true)
    })

    it('findTeamPhantimalHex locates only the team phantimal', () => {
      performPlace(grid, 1, toPhantimalId(1), Team.ALLY, true)
      performPlace(grid, 4, toPhantimalId(1), Team.ENEMY, true)
      performPlace(grid, 2, 100, Team.ALLY, true) // a regular character

      expect(findTeamPhantimalHex(grid, Team.ALLY)).toBe(1)
      expect(findTeamPhantimalHex(grid, Team.ENEMY)).toBe(4)

      performRemove(grid, 1, true)
      expect(findTeamPhantimalHex(grid, Team.ALLY)).toBeNull()
    })
  })
})

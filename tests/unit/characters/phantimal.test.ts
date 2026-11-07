import { beforeEach, describe, expect, it } from 'vitest'

import { canPlaceCharacterOnTeam, setMaxTeamSize } from '@/lib/characters/character'
import { toPhantimalId } from '@/lib/characters/phantimal'
import { performPlace } from '@/lib/characters/place'
import { Grid } from '@/lib/grid'
import { Team } from '@/lib/types/team'
import { STANDARD_ARENA, STANDARD_GRID } from '../fixtures/grid'

describe('phantimal', () => {
  describe('placement on the grid', () => {
    let grid: Grid

    beforeEach(() => {
      grid = new Grid(STANDARD_GRID, STANDARD_ARENA)
    })

    it('is exempt from the team-size limit when the team is full', () => {
      setMaxTeamSize(grid, Team.ALLY, 1)
      performPlace(grid, 1, 100, Team.ALLY) // fills the ally team

      expect(canPlaceCharacterOnTeam(grid, 200, Team.ALLY)).toBe(false)
      expect(canPlaceCharacterOnTeam(grid, toPhantimalId(1), Team.ALLY)).toBe(true)
    })
  })
})

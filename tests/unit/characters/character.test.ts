import { beforeEach, describe, expect, it } from 'vitest'

import {
  canPlaceCharacterOnTeam,
  canPlaceCharacterOnTile,
  setMaxTeamSize,
} from '@/lib/characters/character'
import { Grid } from '@/lib/grid'
import { State } from '@/lib/types/state'
import { Team } from '@/lib/types/team'
import { SMALL_BLOCKED_ARENA, SMALL_GRID } from '../fixtures/grid'

describe('character.ts', () => {
  let grid: Grid

  beforeEach(() => {
    grid = new Grid(SMALL_GRID, SMALL_BLOCKED_ARENA)
  })

  describe('Tile operations', () => {
    it('should check if character can be placed on tile', () => {
      // Available tiles
      expect(canPlaceCharacterOnTile(grid, 1, Team.ALLY)).toBe(true)
      expect(canPlaceCharacterOnTile(grid, 3, Team.ENEMY)).toBe(true)

      // Wrong team
      expect(canPlaceCharacterOnTile(grid, 1, Team.ENEMY)).toBe(false)
      expect(canPlaceCharacterOnTile(grid, 3, Team.ALLY)).toBe(false)

      // Blocked
      expect(canPlaceCharacterOnTile(grid, 5, Team.ALLY)).toBe(false)

      // Occupied - the function returns true for occupied tiles of same team
      // This allows replacement of characters
      grid.getTileById(1).state = State.OCCUPIED_ALLY
      expect(canPlaceCharacterOnTile(grid, 1, Team.ALLY)).toBe(true)
    })
  })

  describe('Edge cases', () => {
    it('should count companions toward the team-size limit', () => {
      const companionId = grid.companionIdOffset + 100

      expect(canPlaceCharacterOnTeam(grid, 100, Team.ALLY)).toBe(true)
      expect(canPlaceCharacterOnTeam(grid, companionId, Team.ALLY)).toBe(true)

      // Fill team to limit
      setMaxTeamSize(grid, Team.ALLY, 1)
      const tile = grid.getTileById(1)
      tile.characterId = 100
      tile.team = Team.ALLY

      expect(canPlaceCharacterOnTeam(grid, 101, Team.ALLY)).toBe(false)
      expect(canPlaceCharacterOnTeam(grid, companionId, Team.ALLY)).toBe(false)
    })
  })
})

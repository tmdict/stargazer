import { beforeEach, describe, expect, it } from 'vitest'

import {
  canPlaceCharacterOnTeam,
  canPlaceCharacterOnTile,
  clearCharacterFromTile,
  findCharacterHex,
  getAllAvailableTilesForTeam,
  getAvailableTeamSize,
  getCharacter,
  getCharacterCount,
  getCharacterPlacements,
  getCharacterTeam,
  getMaxTeamSize,
  getTilesWithCharacters,
  getTilesWithCharactersByTeam,
  hasCharacter,
  isCharacterOnTeam,
  setMaxTeamSize,
} from '@/lib/characters/character'
import { BASE_TEAM_SIZE, Grid } from '@/lib/grid'
import { State } from '@/lib/types/state'
import { Team } from '@/lib/types/team'
import { getTeamFromTileState } from '@/utils/tileStateFormatting'
import { SMALL_BLOCKED_ARENA, SMALL_GRID } from '../fixtures/grid'

describe('character.ts', () => {
  let grid: Grid

  beforeEach(() => {
    grid = new Grid(SMALL_GRID, SMALL_BLOCKED_ARENA)
  })

  describe('Basic character operations', () => {
    it('should handle character presence checks', () => {
      // Empty tile
      expect(getCharacter(grid, 1)).toBeUndefined()
      expect(hasCharacter(grid, 1)).toBe(false)
      expect(getCharacterTeam(grid, 1)).toBeUndefined()

      // With character
      const tile = grid.getTileById(1)
      tile.characterId = 123
      tile.team = Team.ALLY

      expect(getCharacter(grid, 1)).toBe(123)
      expect(hasCharacter(grid, 1)).toBe(true)
      expect(getCharacterTeam(grid, 1)).toBe(Team.ALLY)
    })

    it('should find characters correctly', () => {
      // Not found
      expect(findCharacterHex(grid, 123, Team.ALLY)).toBeNull()

      // Place characters
      const tile1 = grid.getTileById(1)
      tile1.characterId = 100
      tile1.team = Team.ALLY

      const tile2 = grid.getTileById(3)
      tile2.characterId = 200
      tile2.team = Team.ENEMY

      // Find on correct team
      expect(findCharacterHex(grid, 100, Team.ALLY)).toBe(1)
      expect(findCharacterHex(grid, 200, Team.ENEMY)).toBe(3)

      // Not found on wrong team
      expect(findCharacterHex(grid, 100, Team.ENEMY)).toBeNull()
      expect(findCharacterHex(grid, 200, Team.ALLY)).toBeNull()
    })

    it('should count characters correctly', () => {
      expect(getCharacterCount(grid)).toBe(0)

      grid.getTileById(1).characterId = 100
      grid.getTileById(3).characterId = 200

      expect(getCharacterCount(grid)).toBe(2)
    })

    it('should track character placements', () => {
      expect(getCharacterPlacements(grid).size).toBe(0)

      // Add characters
      grid.getTileById(1).characterId = 100
      grid.getTileById(3).characterId = 200

      const placements = getCharacterPlacements(grid)
      expect(placements.size).toBe(2)
      expect(placements.get(1)).toBe(100)
      expect(placements.get(3)).toBe(200)
    })

    it('should get tiles with characters', () => {
      expect(getTilesWithCharacters(grid)).toHaveLength(0)

      grid.getTileById(1).characterId = 100
      grid.getTileById(3).characterId = 200

      const tiles = getTilesWithCharacters(grid)
      expect(tiles).toHaveLength(2)
      // The order depends on internal iteration, just check both are present
      const charIds = tiles.map((t) => t.characterId)
      expect(charIds).toContain(100)
      expect(charIds).toContain(200)
    })
  })

  describe('Team management', () => {
    it('should track team members correctly', () => {
      expect(isCharacterOnTeam(grid, 100, Team.ALLY)).toBe(false)

      const tileA = grid.getTileById(1)
      tileA.characterId = 100
      tileA.team = Team.ALLY
      const tileB = grid.getTileById(3)
      tileB.characterId = 200
      tileB.team = Team.ENEMY

      expect(isCharacterOnTeam(grid, 100, Team.ALLY)).toBe(true)
      expect(isCharacterOnTeam(grid, 100, Team.ENEMY)).toBe(false)
      expect(isCharacterOnTeam(grid, 200, Team.ENEMY)).toBe(true)
    })

    it('should remove characters from team', () => {
      const tileA = grid.getTileById(1)
      tileA.characterId = 100
      tileA.team = Team.ALLY
      const tileB = grid.getTileById(2)
      tileB.characterId = 101
      tileB.team = Team.ALLY

      clearCharacterFromTile(tileA)

      expect(isCharacterOnTeam(grid, 100, Team.ALLY)).toBe(false)
      expect(isCharacterOnTeam(grid, 101, Team.ALLY)).toBe(true)
    })

    it('should handle team size limits', () => {
      const defaultSize = getMaxTeamSize(grid, Team.ALLY)
      expect(defaultSize).toBe(BASE_TEAM_SIZE)
      expect(getMaxTeamSize(grid, Team.ENEMY)).toBe(defaultSize)

      setMaxTeamSize(grid, Team.ALLY, 3)
      expect(getMaxTeamSize(grid, Team.ALLY)).toBe(3)
      expect(getMaxTeamSize(grid, Team.ENEMY)).toBe(defaultSize)

      // Occupancy counts placed units on tiles
      const tileA = grid.getTileById(1)
      tileA.characterId = 100
      tileA.team = Team.ALLY
      const tileB = grid.getTileById(2)
      tileB.characterId = 101
      tileB.team = Team.ALLY

      expect(getAvailableTeamSize(grid, Team.ALLY)).toBe(1)
      expect(getAvailableTeamSize(grid, Team.ENEMY)).toBe(defaultSize)
    })

    it('should determine team from tile state', () => {
      expect(getTeamFromTileState(State.AVAILABLE_ALLY)).toBe(Team.ALLY)
      expect(getTeamFromTileState(State.OCCUPIED_ALLY)).toBe(Team.ALLY)
      expect(getTeamFromTileState(State.AVAILABLE_ENEMY)).toBe(Team.ENEMY)
      expect(getTeamFromTileState(State.OCCUPIED_ENEMY)).toBe(Team.ENEMY)
      expect(getTeamFromTileState(State.BLOCKED)).toBeNull()
      expect(getTeamFromTileState(State.DEFAULT)).toBeNull()
    })

    it('should get available tiles for team', () => {
      const allyTiles = getAllAvailableTilesForTeam(grid, Team.ALLY)
      const enemyTiles = getAllAvailableTilesForTeam(grid, Team.ENEMY)

      expect(allyTiles).toHaveLength(2) // hex 1 and 2
      expect(enemyTiles).toHaveLength(2) // hex 3 and 4

      // Occupy a tile - need to also set characterId for proper state
      const tile1 = grid.getTileById(1)
      tile1.state = State.OCCUPIED_ALLY
      tile1.characterId = 100
      const updatedAllyTiles = getAllAvailableTilesForTeam(grid, Team.ALLY)
      expect(updatedAllyTiles).toHaveLength(1)
    })

    it('should filter tiles with characters by team', () => {
      // Place characters on different teams
      const tile1 = grid.getTileById(1)
      tile1.characterId = 100
      tile1.team = Team.ALLY

      const tile3 = grid.getTileById(3)
      tile3.characterId = 200
      tile3.team = Team.ENEMY

      const allyTiles = getTilesWithCharactersByTeam(grid, Team.ALLY)
      expect(allyTiles).toHaveLength(1)
      expect(allyTiles[0].characterId).toBe(100)

      const enemyTiles = getTilesWithCharactersByTeam(grid, Team.ENEMY)
      expect(enemyTiles).toHaveLength(1)
      expect(enemyTiles[0].characterId).toBe(200)
    })
  })

  describe('Tile operations', () => {
    it('should clear character from tile', () => {
      const tile = grid.getTileById(1)
      tile.characterId = 100
      tile.team = Team.ALLY
      tile.state = State.OCCUPIED_ALLY

      clearCharacterFromTile(tile)

      expect(tile.characterId).toBeUndefined()
      expect(tile.team).toBeUndefined()
      expect(tile.state).toBe(State.AVAILABLE_ALLY)

      // Enemy tiles restore to their own available state
      const enemyTile = grid.getTileById(3)
      enemyTile.characterId = 200
      enemyTile.team = Team.ENEMY
      enemyTile.state = State.OCCUPIED_ENEMY
      clearCharacterFromTile(enemyTile)
      expect(enemyTile.state).toBe(State.AVAILABLE_ENEMY)
    })

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

    it('should check if character can be placed on team', () => {
      // Within limit
      expect(canPlaceCharacterOnTeam(grid, 100, Team.ALLY)).toBe(true)

      // Already on team
      const tileA = grid.getTileById(1)
      tileA.characterId = 100
      tileA.team = Team.ALLY
      expect(canPlaceCharacterOnTeam(grid, 100, Team.ALLY)).toBe(false)

      // Team full (capacity counts occupied tiles)
      setMaxTeamSize(grid, Team.ALLY, 2)
      const tileB = grid.getTileById(2)
      tileB.characterId = 101
      tileB.team = Team.ALLY
      expect(canPlaceCharacterOnTeam(grid, 102, Team.ALLY)).toBe(false)
    })
  })

  describe('Edge cases', () => {
    it('should handle companion offset correctly', () => {
      const companionId = grid.companionIdOffset + 100

      // Regular character
      expect(canPlaceCharacterOnTeam(grid, 100, Team.ALLY)).toBe(true)

      // Companion (special handling for team limit)
      expect(canPlaceCharacterOnTeam(grid, companionId, Team.ALLY)).toBe(true)

      // Fill team to limit
      setMaxTeamSize(grid, Team.ALLY, 1)
      const tile = grid.getTileById(1)
      tile.characterId = 100
      tile.team = Team.ALLY

      // Regular character blocked by limit
      expect(canPlaceCharacterOnTeam(grid, 101, Team.ALLY)).toBe(false)

      // Companion not allowed when team is full (companions DO count toward limit in this implementation)
      expect(canPlaceCharacterOnTeam(grid, companionId, Team.ALLY)).toBe(false)
    })

    it('should handle missing team data gracefully', () => {
      const tile = grid.getTileById(1)
      tile.characterId = 100
      // No team set

      expect(getCharacterTeam(grid, 1)).toBeUndefined()

      // Clear should handle missing team
      clearCharacterFromTile(tile)
      expect(tile.state).toBe(State.AVAILABLE_ALLY)
    })

    it('should reject invalid max team sizes, leaving the limit unchanged', () => {
      const defaultSize = getMaxTeamSize(grid, Team.ALLY)

      expect(setMaxTeamSize(grid, Team.ALLY, 0)).toBe(false)
      expect(setMaxTeamSize(grid, Team.ALLY, -1)).toBe(false)
      expect(setMaxTeamSize(grid, Team.ALLY, 2.5)).toBe(false)
      expect(setMaxTeamSize(grid, Team.ALLY, grid.getAllTiles().length + 1)).toBe(false)
      expect(getMaxTeamSize(grid, Team.ALLY)).toBe(defaultSize)
    })
  })
})

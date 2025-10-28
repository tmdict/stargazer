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
  getOpposingTeam,
  getTeamCharacters,
  getTeamFromTileState,
  getTilesWithCharacters,
  getTilesWithCharactersByTeam,
  hasCharacter,
  isCharacterOnTeam,
  removeCharacterFromTeam,
  setMaxTeamSize,
  tileHasCharacter,
} from '@/lib/characters/character'
import { Grid } from '@/lib/grid'
import type { GridPreset } from '@/lib/types/grid'
import { State } from '@/lib/types/state'
import { Team } from '@/lib/types/team'

// Create a simple test grid preset
const TEST_GRID: GridPreset = {
  hex: [[3], [2, 4], [1, 5]],
  qOffset: [0, -1, -1],
}

// Test arena that works with TEST_GRID
const TEST_ARENA = {
  id: 1,
  name: 'Test',
  grid: [
    { type: State.AVAILABLE_ALLY, hex: [1, 2] },
    { type: State.AVAILABLE_ENEMY, hex: [3, 4] },
    { type: State.BLOCKED, hex: [5] },
  ],
}

describe('character.ts', () => {
  let grid: Grid

  beforeEach(() => {
    grid = new Grid(TEST_GRID, TEST_ARENA)
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

    it('should throw error for invalid hex id', () => {
      expect(() => getCharacter(grid, 999)).toThrow()
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
      // Note: getCharacterPlacements returns Map<hexId, characterId> not Map<characterId, hexId>
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

    it('should identify tiles with characters', () => {
      const tile = grid.getTileById(1)
      expect(tileHasCharacter(tile)).toBe(false)

      tile.characterId = 100
      expect(tileHasCharacter(tile)).toBe(true)

      tile.characterId = undefined
      expect(tileHasCharacter(tile)).toBe(false)
    })
  })

  describe('Team management', () => {
    it('should track team members correctly', () => {
      const allyTeam = getTeamCharacters(grid, Team.ALLY)
      const enemyTeam = getTeamCharacters(grid, Team.ENEMY)

      expect(allyTeam.size).toBe(0)
      expect(enemyTeam.size).toBe(0)

      // Add team members
      allyTeam.add(100)
      allyTeam.add(101)
      enemyTeam.add(200)

      expect(allyTeam.size).toBe(2)
      expect(enemyTeam.size).toBe(1)
      expect(isCharacterOnTeam(grid, 100, Team.ALLY)).toBe(true)
      expect(isCharacterOnTeam(grid, 100, Team.ENEMY)).toBe(false)
    })

    it('should remove characters from team', () => {
      const allyTeam = getTeamCharacters(grid, Team.ALLY)
      allyTeam.add(100)
      allyTeam.add(101)

      removeCharacterFromTeam(grid, 100, Team.ALLY)
      expect(allyTeam.has(100)).toBe(false)
      expect(allyTeam.has(101)).toBe(true)
    })

    it('should handle team size limits', () => {
      // Default team size is based on grid size
      const defaultSize = getMaxTeamSize(grid, Team.ALLY)
      expect(getMaxTeamSize(grid, Team.ALLY)).toBe(defaultSize)
      expect(getMaxTeamSize(grid, Team.ENEMY)).toBe(defaultSize)

      setMaxTeamSize(grid, Team.ALLY, 3)
      expect(getMaxTeamSize(grid, Team.ALLY)).toBe(3)
      expect(getMaxTeamSize(grid, Team.ENEMY)).toBe(defaultSize)

      // Add team members
      const allyTeam = getTeamCharacters(grid, Team.ALLY)
      allyTeam.add(100)
      allyTeam.add(101)

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

    it('should return opposing team', () => {
      expect(getOpposingTeam(Team.ALLY)).toBe(Team.ENEMY)
      expect(getOpposingTeam(Team.ENEMY)).toBe(Team.ALLY)
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
    })

    it('should check if character can be placed on tile', () => {
      // Note: canPlaceCharacterOnTile takes (grid, hexId, team) not (tile, team)
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
      const allyTeam = getTeamCharacters(grid, Team.ALLY)

      // Within limit
      expect(canPlaceCharacterOnTeam(grid, 100, Team.ALLY)).toBe(true)

      // Already on team
      allyTeam.add(100)
      expect(canPlaceCharacterOnTeam(grid, 100, Team.ALLY)).toBe(false)

      // Team full
      setMaxTeamSize(grid, Team.ALLY, 2)
      allyTeam.add(101)
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
      const allyTeam = getTeamCharacters(grid, Team.ALLY)
      setMaxTeamSize(grid, Team.ALLY, 1)
      allyTeam.add(100)

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

    it('should handle state transitions correctly', () => {
      const tile = grid.getTileById(1)

      // Available -> Occupied
      tile.state = State.AVAILABLE_ALLY
      tile.characterId = 100
      tile.team = Team.ALLY
      tile.state = State.OCCUPIED_ALLY

      // Clear back to available
      clearCharacterFromTile(tile)
      expect(tile.state).toBe(State.AVAILABLE_ALLY)

      // Enemy tile
      const enemyTile = grid.getTileById(3)
      enemyTile.state = State.OCCUPIED_ENEMY
      clearCharacterFromTile(enemyTile)
      expect(enemyTile.state).toBe(State.AVAILABLE_ENEMY)
    })
  })
})

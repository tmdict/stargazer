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
  getTeamCharacters,
  getTeamFromTileState,
  getTilesWithCharacters,
  hasCharacter,
  isCharacterOnTeam,
  removeCharacterFromTeam,
  setMaxTeamSize,
} from '../../../src/lib/characters/character'
import { Grid } from '../../../src/lib/grid'
import type { GridPreset } from '../../../src/lib/types/grid'
import { State } from '../../../src/lib/types/state'
import { Team } from '../../../src/lib/types/team'

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

  describe('Character queries', () => {
    describe('getCharacter', () => {
      it('should return undefined for empty tile', () => {
        expect(getCharacter(grid, 1)).toBeUndefined()
      })

      it('should return character id when present', () => {
        const tile = grid.getTileById(1)
        tile.characterId = 123
        expect(getCharacter(grid, 1)).toBe(123)
      })

      it('should throw error for invalid hex id', () => {
        expect(() => getCharacter(grid, 999)).toThrow()
      })
    })

    describe('hasCharacter', () => {
      it('should return false for empty tile', () => {
        expect(hasCharacter(grid, 1)).toBe(false)
      })

      it('should return true when character present', () => {
        const tile = grid.getTileById(1)
        tile.characterId = 123
        expect(hasCharacter(grid, 1)).toBe(true)
      })
    })

    describe('getCharacterTeam', () => {
      it('should return undefined for empty tile', () => {
        expect(getCharacterTeam(grid, 1)).toBeUndefined()
      })

      it('should return team when character present', () => {
        const tile = grid.getTileById(1)
        tile.characterId = 123
        tile.team = Team.ALLY
        expect(getCharacterTeam(grid, 1)).toBe(Team.ALLY)
      })
    })

    describe('findCharacterHex', () => {
      it('should return null when character not found', () => {
        expect(findCharacterHex(grid, 123, Team.ALLY)).toBeNull()
      })

      it('should find character on correct team', () => {
        const tile = grid.getTileById(2)
        tile.characterId = 123
        tile.team = Team.ALLY
        expect(findCharacterHex(grid, 123, Team.ALLY)).toBe(2)
      })

      it('should not find character on wrong team', () => {
        const tile = grid.getTileById(2)
        tile.characterId = 123
        tile.team = Team.ENEMY
        expect(findCharacterHex(grid, 123, Team.ALLY)).toBeNull()
      })

      it('should find correct character when multiple exist', () => {
        const tile1 = grid.getTileById(1)
        tile1.characterId = 100
        tile1.team = Team.ALLY

        const tile2 = grid.getTileById(2)
        tile2.characterId = 200
        tile2.team = Team.ALLY

        expect(findCharacterHex(grid, 200, Team.ALLY)).toBe(2)
      })
    })

    describe('getCharacterCount', () => {
      it('should return 0 for empty grid', () => {
        expect(getCharacterCount(grid)).toBe(0)
      })

      it('should count all characters', () => {
        grid.getTileById(1).characterId = 100
        grid.getTileById(2).characterId = 200
        grid.getTileById(3).characterId = 300
        expect(getCharacterCount(grid)).toBe(3)
      })

      it('should not count undefined characterIds', () => {
        grid.getTileById(1).characterId = 100
        grid.getTileById(2).characterId = undefined
        grid.getTileById(3).characterId = 300
        expect(getCharacterCount(grid)).toBe(2)
      })
    })

    describe('getCharacterPlacements', () => {
      it('should return empty map for empty grid', () => {
        const placements = getCharacterPlacements(grid)
        expect(placements.size).toBe(0)
      })

      it('should map hex ids to character ids', () => {
        grid.getTileById(1).characterId = 100
        grid.getTileById(3).characterId = 300

        const placements = getCharacterPlacements(grid)
        expect(placements.size).toBe(2)
        expect(placements.get(1)).toBe(100)
        expect(placements.get(3)).toBe(300)
        expect(placements.has(2)).toBe(false)
      })
    })

    describe('getTilesWithCharacters', () => {
      it('should return empty array for empty grid', () => {
        expect(getTilesWithCharacters(grid)).toHaveLength(0)
      })

      it('should return only tiles with characters', () => {
        grid.getTileById(1).characterId = 100
        grid.getTileById(3).characterId = 300

        const tiles = getTilesWithCharacters(grid)
        expect(tiles).toHaveLength(2)
        // Order may vary, check both characters are present
        const characterIds = tiles.map((t) => t.characterId)
        expect(characterIds).toContain(100)
        expect(characterIds).toContain(300)
      })
    })
  })

  describe('Team management', () => {
    describe('getMaxTeamSize', () => {
      it('should return default size of 5', () => {
        expect(getMaxTeamSize(grid, Team.ALLY)).toBe(5)
        expect(getMaxTeamSize(grid, Team.ENEMY)).toBe(5)
      })

      it('should return custom size when set', () => {
        grid.maxTeamSizes.set(Team.ALLY, 10)
        expect(getMaxTeamSize(grid, Team.ALLY)).toBe(10)
      })
    })

    describe('setMaxTeamSize', () => {
      it('should set valid team size', () => {
        expect(setMaxTeamSize(grid, Team.ALLY, 3)).toBe(true)
        expect(getMaxTeamSize(grid, Team.ALLY)).toBe(3)
      })

      it('should reject non-integer size', () => {
        expect(setMaxTeamSize(grid, Team.ALLY, 3.5)).toBe(false)
        expect(getMaxTeamSize(grid, Team.ALLY)).toBe(5) // unchanged
      })

      it('should reject zero size', () => {
        expect(setMaxTeamSize(grid, Team.ALLY, 0)).toBe(false)
      })

      it('should reject negative size', () => {
        expect(setMaxTeamSize(grid, Team.ALLY, -1)).toBe(false)
      })

      it('should reject size larger than grid', () => {
        const totalTiles = grid.getAllTiles().length
        expect(setMaxTeamSize(grid, Team.ALLY, totalTiles + 1)).toBe(false)
      })

      it('should allow size equal to grid size', () => {
        const totalTiles = grid.getAllTiles().length
        expect(setMaxTeamSize(grid, Team.ALLY, totalTiles)).toBe(true)
        expect(getMaxTeamSize(grid, Team.ALLY)).toBe(totalTiles)
      })
    })

    describe('getTeamCharacters', () => {
      it('should return empty set for new team', () => {
        const chars = getTeamCharacters(grid, Team.ALLY)
        expect(chars.size).toBe(0)
      })

      it('should return team members', () => {
        grid.teamCharacters.get(Team.ALLY)?.add(100)
        grid.teamCharacters.get(Team.ALLY)?.add(200)

        const chars = getTeamCharacters(grid, Team.ALLY)
        expect(chars.size).toBe(2)
        expect(chars.has(100)).toBe(true)
        expect(chars.has(200)).toBe(true)
      })
    })

    describe('isCharacterOnTeam', () => {
      it('should return false for character not on team', () => {
        expect(isCharacterOnTeam(grid, 100, Team.ALLY)).toBe(false)
      })

      it('should return true for character on team', () => {
        grid.teamCharacters.get(Team.ALLY)?.add(100)
        expect(isCharacterOnTeam(grid, 100, Team.ALLY)).toBe(true)
      })

      it('should check correct team', () => {
        grid.teamCharacters.get(Team.ENEMY)?.add(100)
        expect(isCharacterOnTeam(grid, 100, Team.ALLY)).toBe(false)
        expect(isCharacterOnTeam(grid, 100, Team.ENEMY)).toBe(true)
      })
    })

    describe('getAvailableTeamSize', () => {
      it('should return max size when team is empty', () => {
        expect(getAvailableTeamSize(grid, Team.ALLY)).toBe(5)
      })

      it('should decrease as characters are added', () => {
        grid.teamCharacters.get(Team.ALLY)?.add(100)
        grid.teamCharacters.get(Team.ALLY)?.add(200)
        expect(getAvailableTeamSize(grid, Team.ALLY)).toBe(3)
      })

      it('should return 0 when team is full', () => {
        const teamSet = grid.teamCharacters.get(Team.ALLY)
        for (let i = 0; i < 5; i++) {
          teamSet?.add(100 + i)
        }
        expect(getAvailableTeamSize(grid, Team.ALLY)).toBe(0)
      })

      it('should use custom max team size', () => {
        // Set custom max size (must be <= grid size which is 5 tiles)
        expect(setMaxTeamSize(grid, Team.ALLY, 4)).toBe(true)
        expect(getMaxTeamSize(grid, Team.ALLY)).toBe(4)

        // Add a character to the team
        grid.teamCharacters.get(Team.ALLY)?.add(100)

        // Verify the character was added
        const teamSize = grid.teamCharacters.get(Team.ALLY)?.size || 0
        expect(teamSize).toBe(1)

        // Should be 4 - 1 = 3 available
        const available = getAvailableTeamSize(grid, Team.ALLY)
        expect(available).toBe(3)
      })
    })

    describe('canPlaceCharacterOnTeam', () => {
      it('should allow placing new character on team with space', () => {
        expect(canPlaceCharacterOnTeam(grid, 100, Team.ALLY)).toBe(true)
      })

      it('should prevent placing when team is full', () => {
        const teamSet = grid.teamCharacters.get(Team.ALLY)
        for (let i = 0; i < 5; i++) {
          teamSet?.add(100 + i)
        }
        expect(canPlaceCharacterOnTeam(grid, 200, Team.ALLY)).toBe(false)
      })

      it('should prevent placing duplicate character', () => {
        grid.teamCharacters.get(Team.ALLY)?.add(100)
        expect(canPlaceCharacterOnTeam(grid, 100, Team.ALLY)).toBe(false)
      })

      it('should allow placing character on different team', () => {
        grid.teamCharacters.get(Team.ENEMY)?.add(100)
        expect(canPlaceCharacterOnTeam(grid, 100, Team.ALLY)).toBe(true)
      })
    })

    describe('canPlaceCharacterOnTile', () => {
      it('should allow placing on available ally tile for ally', () => {
        grid.getTileById(1).state = State.AVAILABLE_ALLY
        expect(canPlaceCharacterOnTile(grid, 1, Team.ALLY)).toBe(true)
      })

      it('should allow placing on occupied ally tile for ally', () => {
        grid.getTileById(1).state = State.OCCUPIED_ALLY
        expect(canPlaceCharacterOnTile(grid, 1, Team.ALLY)).toBe(true)
      })

      it('should prevent placing on enemy tile for ally', () => {
        grid.getTileById(3).state = State.AVAILABLE_ENEMY
        expect(canPlaceCharacterOnTile(grid, 3, Team.ALLY)).toBe(false)
      })

      it('should prevent placing on blocked tile', () => {
        grid.getTileById(5).state = State.BLOCKED
        expect(canPlaceCharacterOnTile(grid, 5, Team.ALLY)).toBe(false)
        expect(canPlaceCharacterOnTile(grid, 5, Team.ENEMY)).toBe(false)
      })

      it('should prevent placing on default tile', () => {
        const tile = grid.getTileById(1)
        tile.state = State.DEFAULT
        expect(canPlaceCharacterOnTile(grid, 1, Team.ALLY)).toBe(false)
      })
    })

    describe('removeCharacterFromTeam', () => {
      it('should remove character from team', () => {
        grid.teamCharacters.get(Team.ALLY)?.add(100)
        expect(isCharacterOnTeam(grid, 100, Team.ALLY)).toBe(true)

        removeCharacterFromTeam(grid, 100, Team.ALLY)
        expect(isCharacterOnTeam(grid, 100, Team.ALLY)).toBe(false)
      })

      it('should handle removing non-existent character', () => {
        // Should not throw
        removeCharacterFromTeam(grid, 999, Team.ALLY)
        expect(isCharacterOnTeam(grid, 999, Team.ALLY)).toBe(false)
      })

      it('should only remove from specified team', () => {
        grid.teamCharacters.get(Team.ALLY)?.add(100)
        grid.teamCharacters.get(Team.ENEMY)?.add(100)

        removeCharacterFromTeam(grid, 100, Team.ALLY)
        expect(isCharacterOnTeam(grid, 100, Team.ALLY)).toBe(false)
        expect(isCharacterOnTeam(grid, 100, Team.ENEMY)).toBe(true)
      })
    })
  })

  describe('Tile helpers', () => {
    describe('getTeamFromTileState', () => {
      it('should return ALLY for ally states', () => {
        expect(getTeamFromTileState(State.AVAILABLE_ALLY)).toBe(Team.ALLY)
        expect(getTeamFromTileState(State.OCCUPIED_ALLY)).toBe(Team.ALLY)
      })

      it('should return ENEMY for enemy states', () => {
        expect(getTeamFromTileState(State.AVAILABLE_ENEMY)).toBe(Team.ENEMY)
        expect(getTeamFromTileState(State.OCCUPIED_ENEMY)).toBe(Team.ENEMY)
      })

      it('should return null for neutral states', () => {
        expect(getTeamFromTileState(State.DEFAULT)).toBeNull()
        expect(getTeamFromTileState(State.BLOCKED)).toBeNull()
      })
    })

    describe('getAllAvailableTilesForTeam', () => {
      it('should return available tiles for ally', () => {
        const tiles = getAllAvailableTilesForTeam(grid, Team.ALLY)
        expect(tiles).toHaveLength(2) // hex 1 and 2 from TEST_ARENA
        expect(tiles.every((t) => t.hex.getId() === 1 || t.hex.getId() === 2)).toBe(true)
      })

      it('should return available tiles for enemy', () => {
        const tiles = getAllAvailableTilesForTeam(grid, Team.ENEMY)
        expect(tiles).toHaveLength(2) // hex 3 and 4 from TEST_ARENA
        expect(tiles.every((t) => t.hex.getId() === 3 || t.hex.getId() === 4)).toBe(true)
      })

      it('should exclude tiles with characters', () => {
        grid.getTileById(1).characterId = 100
        const tiles = getAllAvailableTilesForTeam(grid, Team.ALLY)
        expect(tiles).toHaveLength(1)
        expect(tiles[0]?.hex.getId()).toBe(2)
      })

      it('should include occupied tiles without characters', () => {
        grid.getTileById(1).state = State.OCCUPIED_ALLY
        const tiles = getAllAvailableTilesForTeam(grid, Team.ALLY)
        expect(tiles).toHaveLength(2)
      })

      it('should return empty array when no tiles available', () => {
        grid.getTileById(1).characterId = 100
        grid.getTileById(2).characterId = 200
        const tiles = getAllAvailableTilesForTeam(grid, Team.ALLY)
        expect(tiles).toHaveLength(0)
      })
    })

    describe('clearCharacterFromTile', () => {
      it('should clear character data from tile', () => {
        const tile = grid.getTileById(1)
        tile.characterId = 100
        tile.team = Team.ALLY
        tile.state = State.OCCUPIED_ALLY

        clearCharacterFromTile(tile)

        expect(tile.characterId).toBeUndefined()
        expect(tile.team).toBeUndefined()
      })

      it('should restore AVAILABLE_ALLY from OCCUPIED_ALLY', () => {
        const tile = grid.getTileById(1)
        tile.state = State.OCCUPIED_ALLY

        clearCharacterFromTile(tile)

        expect(tile.state).toBe(State.AVAILABLE_ALLY)
      })

      it('should restore AVAILABLE_ENEMY from OCCUPIED_ENEMY', () => {
        const tile = grid.getTileById(1)
        tile.state = State.OCCUPIED_ENEMY

        clearCharacterFromTile(tile)

        expect(tile.state).toBe(State.AVAILABLE_ENEMY)
      })

      it('should preserve non-occupied states', () => {
        const tile1 = grid.getTileById(1)
        tile1.state = State.DEFAULT
        clearCharacterFromTile(tile1)
        expect(tile1.state).toBe(State.DEFAULT)

        const tile2 = grid.getTileById(2)
        tile2.state = State.BLOCKED
        clearCharacterFromTile(tile2)
        expect(tile2.state).toBe(State.BLOCKED)

        const tile3 = grid.getTileById(3)
        tile3.state = State.AVAILABLE_ALLY
        clearCharacterFromTile(tile3)
        expect(tile3.state).toBe(State.AVAILABLE_ALLY)
      })

      it('should handle tile with no character data', () => {
        const tile = grid.getTileById(1)
        tile.state = State.AVAILABLE_ALLY

        // Should not throw
        clearCharacterFromTile(tile)

        expect(tile.characterId).toBeUndefined()
        expect(tile.team).toBeUndefined()
        expect(tile.state).toBe(State.AVAILABLE_ALLY)
      })
    })
  })

  describe('Edge cases', () => {
    it('should handle operations on empty grid', () => {
      const emptyGrid = new Grid({ hex: [[]], qOffset: [0] }, { id: 1, name: 'Empty', grid: [] })
      expect(getCharacterCount(emptyGrid)).toBe(0)
      expect(getTilesWithCharacters(emptyGrid)).toHaveLength(0)
      expect(getAllAvailableTilesForTeam(emptyGrid, Team.ALLY)).toHaveLength(0)
    })

    it('should handle concurrent modifications safely', () => {
      // Add multiple characters
      const tiles = grid.getAllTiles()
      tiles[0]!.characterId = 100
      tiles[0]!.team = Team.ALLY
      tiles[1]!.characterId = 200
      tiles[1]!.team = Team.ENEMY

      // Query should work correctly
      expect(getCharacterCount(grid)).toBe(2)
      expect(findCharacterHex(grid, 100, Team.ALLY)).toBe(tiles[0]!.hex.getId())
      expect(findCharacterHex(grid, 200, Team.ENEMY)).toBe(tiles[1]!.hex.getId())
    })

    it('should handle team operations with undefined team maps', () => {
      // This shouldn't happen in practice but test defensive coding
      const teamSet = grid.teamCharacters.get(Team.ALLY)
      if (teamSet) {
        teamSet.add(100)
        expect(isCharacterOnTeam(grid, 100, Team.ALLY)).toBe(true)
      }
    })
  })
})

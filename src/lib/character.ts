import type { Grid, GridTile } from './grid'
import { Team } from './types/team'

/**
 * Character manager - simple character operations without skill handling
 * Complex operations with skill integration are in transactions/
 */

// Character Queries

export function getCharacter(grid: Grid, hexId: number): number | undefined {
  return grid.getTileById(hexId).characterId
}

export function hasCharacter(grid: Grid, hexId: number): boolean {
  return grid.getTileById(hexId).characterId !== undefined
}

export function getCharacterTeam(grid: Grid, hexId: number): Team | undefined {
  return grid.getTileById(hexId).team
}

export function getCharacterCount(grid: Grid): number {
  let count = 0
  for (const tile of grid.getAllTiles()) {
    if (tile.characterId) {
      count++
    }
  }
  return count
}

export function getCharacterPlacements(grid: Grid): Map<number, number> {
  const placements = new Map<number, number>()
  for (const tile of grid.getAllTiles()) {
    if (tile.characterId) {
      placements.set(tile.hex.getId(), tile.characterId)
    }
  }
  return placements
}

export function getTilesWithCharacters(grid: Grid): GridTile[] {
  return grid.getAllTiles().filter((tile) => tile.characterId !== undefined)
}

export function findCharacterHex(grid: Grid, characterId: number, team: Team): number | null {
  for (const tile of grid.getAllTiles()) {
    if (tile.characterId === characterId && tile.team === team) {
      return tile.hex.getId()
    }
  }
  return null
}
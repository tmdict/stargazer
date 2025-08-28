import type { Grid, GridTile } from '../grid'
import { State } from '../types/state'
import { Team } from '../types/team'

// Character queries

export function getCharacter(grid: Grid, hexId: number): number | undefined {
  return grid.getTileById(hexId).characterId
}

export function hasCharacter(grid: Grid, hexId: number): boolean {
  return getCharacter(grid, hexId) !== undefined
}

export function tileHasCharacter(tile: GridTile): boolean {
  return tile.characterId !== undefined
}

export function getCharacterTeam(grid: Grid, hexId: number): Team | undefined {
  return grid.getTileById(hexId).team
}

export function findCharacterHex(grid: Grid, characterId: number, team: Team): number | null {
  for (const tile of grid.getAllTiles()) {
    if (tile.characterId === characterId && tile.team === team) {
      return tile.hex.getId()
    }
  }
  return null
}

export function getCharacterCount(grid: Grid): number {
  let count = 0
  for (const tile of grid.getAllTiles()) {
    if (tileHasCharacter(tile)) {
      count++
    }
  }
  return count
}

export function getCharacterPlacements(grid: Grid): Map<number, number> {
  const placements = new Map<number, number>()
  for (const tile of grid.getAllTiles()) {
    if (tileHasCharacter(tile)) {
      placements.set(tile.hex.getId(), tile.characterId!)
    }
  }
  return placements
}

export function getTilesWithCharacters(grid: Grid): GridTile[] {
  return grid.getAllTiles().filter(tileHasCharacter)
}

export function getTilesWithCharactersByTeam(grid: Grid, team: Team): GridTile[] {
  return getTilesWithCharacters(grid).filter((tile) => tile.team === team)
}

// Team management

export function getOpposingTeam(team: Team): Team {
  return team === Team.ALLY ? Team.ENEMY : Team.ALLY
}

export function getMaxTeamSize(grid: Grid, team: Team): number {
  return grid.maxTeamSizes.get(team) || 5
}

export function setMaxTeamSize(grid: Grid, team: Team, size: number): boolean {
  const maxPossibleSize = grid.getAllTiles().length
  if (!Number.isInteger(size) || size <= 0 || size > maxPossibleSize) {
    return false // Invalid input
  }
  grid.maxTeamSizes.set(team, size)
  return true
}

export function getTeamCharacters(grid: Grid, team: Team): Set<number> {
  return grid.teamCharacters.get(team) || new Set()
}

export function isCharacterOnTeam(grid: Grid, characterId: number, team: Team): boolean {
  return grid.teamCharacters.get(team)?.has(characterId) || false
}

export function getAvailableTeamSize(grid: Grid, team: Team): number {
  return getMaxTeamSize(grid, team) - getTeamCharacters(grid, team).size
}

export function canPlaceCharacterOnTeam(grid: Grid, characterId: number, team: Team): boolean {
  const available = getAvailableTeamSize(grid, team)
  if (available <= 0) return false
  return !isCharacterOnTeam(grid, characterId, team)
}

export function canPlaceCharacterOnTile(grid: Grid, hexId: number, team: Team): boolean {
  const tile = grid.getTileById(hexId)
  const state = tile.state
  const availableState = team === Team.ALLY ? State.AVAILABLE_ALLY : State.AVAILABLE_ENEMY
  const occupiedState = team === Team.ALLY ? State.OCCUPIED_ALLY : State.OCCUPIED_ENEMY

  return state === availableState || state === occupiedState
}

export function removeCharacterFromTeam(grid: Grid, characterId: number, team: Team): void {
  grid.teamCharacters.get(team)?.delete(characterId)
}

// Tile helpers

export function getTeamFromTileState(state: State): Team | null {
  if (state === State.AVAILABLE_ALLY || state === State.OCCUPIED_ALLY) return Team.ALLY
  if (state === State.AVAILABLE_ENEMY || state === State.OCCUPIED_ENEMY) return Team.ENEMY
  return null
}

export function getAllAvailableTilesForTeam(grid: Grid, team: Team): GridTile[] {
  const availableState = team === Team.ALLY ? State.AVAILABLE_ALLY : State.AVAILABLE_ENEMY
  const occupiedState = team === Team.ALLY ? State.OCCUPIED_ALLY : State.OCCUPIED_ENEMY
  return grid
    .getAllTiles()
    .filter(
      (tile) =>
        (tile.state === availableState || tile.state === occupiedState) && !tileHasCharacter(tile),
    )
}

export function clearCharacterFromTile(tile: GridTile): void {
  const currentState = tile.state

  // Delete character data
  delete tile.characterId
  delete tile.team

  // Restore original tile state based on current state
  if (currentState === State.OCCUPIED_ALLY) {
    tile.state = State.AVAILABLE_ALLY
  } else if (currentState === State.OCCUPIED_ENEMY) {
    tile.state = State.AVAILABLE_ENEMY
  } else {
    // Keep current state if it wasn't an occupied state
    tile.state = currentState
  }
}

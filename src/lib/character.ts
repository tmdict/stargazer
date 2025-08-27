import type { Grid, GridTile } from './grid'
import { State } from './types/state'
import { Team } from './types/team'

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

// Team and tile helpers

export function getAllAvailableTilesForTeam(grid: Grid, team: Team): GridTile[] {
  const availableState = team === Team.ALLY ? State.AVAILABLE_ALLY : State.AVAILABLE_ENEMY
  const occupiedState = team === Team.ALLY ? State.OCCUPIED_ALLY : State.OCCUPIED_ENEMY
  return grid
    .getAllTiles()
    .filter(
      (tile) =>
        (tile.state === availableState || tile.state === occupiedState) && !tile.characterId,
    )
}

export function getTeamFromTileState(state: State): Team | null {
  if (state === State.AVAILABLE_ALLY || state === State.OCCUPIED_ALLY) return Team.ALLY
  if (state === State.AVAILABLE_ENEMY || state === State.OCCUPIED_ENEMY) return Team.ENEMY
  return null
}

export function canPlaceCharacterOnTeam(grid: Grid, characterId: number, team: Team): boolean {
  const available = grid.getAvailableTeamSize(team)
  if (available <= 0) return false
  return !grid.isCharacterOnTeam(characterId, team)
}

export function canPlaceCharacterOnTile(grid: Grid, hexId: number, team: Team): boolean {
  const tile = grid.getTileById(hexId)
  const state = tile.state
  const availableState = team === Team.ALLY ? State.AVAILABLE_ALLY : State.AVAILABLE_ENEMY
  const occupiedState = team === Team.ALLY ? State.OCCUPIED_ALLY : State.OCCUPIED_ENEMY

  return state === availableState || state === occupiedState
}

// Character modification helpers

export function removeCharacterFromTeam(grid: Grid, characterId: number, team: Team): void {
  grid.getTeamCharacters(team).delete(characterId)
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

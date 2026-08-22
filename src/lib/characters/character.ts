import { COMPANION_ID_OFFSET, type Grid, type GridTile } from '../grid'
import { State } from '../types/state'
import { Team } from '../types/team'
import { isPhantimalId } from './phantimal'
import { isPlaceholderId } from './placeholder'
import { isSynergyHeroId, toSynergyId } from './synergy'

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

// A base hero, as opposed to a skill-spawned companion or a seasonal phantimal. One
// comparison covers both: companion ids are N * COMPANION_ID_OFFSET + base and
// phantimal ids sit higher still, so every non-base unit lands at or above the offset.
export function isBaseHeroId(characterId: number): boolean {
  return characterId < COMPANION_ID_OFFSET
}

// Identity for hero-only surfaces (roster card, paragon): isBaseHeroId alone
// admits the placeholder band.
export function isRealHeroId(characterId: number): boolean {
  return isBaseHeroId(characterId) && !isPlaceholderId(characterId)
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

export function isCharacterOnTeam(grid: Grid, characterId: number, team: Team): boolean {
  return getTilesWithCharactersByTeam(grid, team).some((tile) => tile.characterId === characterId)
}

export function getAvailableTeamSize(grid: Grid, team: Team): number {
  // Phantimals and synergy heroes occupy tiles but don't hold a team slot (the
  // synergy hero is the friend-assist "+1"; companions it spawns count like any
  // other, balanced by their skill's capacity bump).
  const occupied = getTilesWithCharactersByTeam(grid, team).filter(
    (tile) => !isPhantimalId(tile.characterId!) && !isSynergyHeroId(tile.characterId!),
  ).length
  return getMaxTeamSize(grid, team) - occupied
}

export function canPlaceCharacterOnTeam(grid: Grid, characterId: number, team: Team): boolean {
  // Phantimals don't count toward team size and are capped at one per team by the
  // placement layer, so capacity/duplicate checks don't apply to them.
  if (isPhantimalId(characterId)) return true
  // The synergy hero replaces capacity and duplicate checks with its own cap of
  // one per team; its offset id keeps every duplicate check blind to it. Its
  // companions fall through to the normal companion rules.
  if (isSynergyHeroId(characterId)) return findTeamSynergyHex(grid, team) === null
  const available = getAvailableTeamSize(grid, team)
  if (available <= 0) return false
  // Placeholders consume capacity like heroes but skip the duplicate check:
  // copies repeat freely (see placeholder.ts).
  if (isPlaceholderId(characterId)) return true
  return !isCharacterOnTeam(grid, characterId, team)
}

// Which id a roster pick of baseId should place: the base id when it passes the
// normal gate, else the synergy copy when the affordance is on and the team's
// slot is free, else nothing. The single decision point for every placement
// entry (click, tap, popup, drag), so hover cues and drops can't disagree.
export function resolvePlacement(
  grid: Grid,
  baseId: number,
  team: Team,
  synergyOn: boolean,
): number | null {
  if (canPlaceCharacterOnTeam(grid, baseId, team)) return baseId
  const synergyId = toSynergyId(baseId)
  if (synergyOn && canPlaceCharacterOnTeam(grid, synergyId, team)) return synergyId
  return null
}

// Hex of the team's synergy hero, or null; the assist slot is capped at one per
// team.
export function findTeamSynergyHex(grid: Grid, team: Team): number | null {
  for (const tile of grid.getAllTiles()) {
    if (tile.team === team && tile.characterId !== undefined && isSynergyHeroId(tile.characterId)) {
      return tile.hex.getId()
    }
  }
  return null
}

export function synergySlotFree(grid: Grid, team: Team): boolean {
  return findTeamSynergyHex(grid, team) === null
}

// Hex of the team's on-field phantimal, or null. Phantimals are capped at one per
// team, so this identifies the one to clear before placing a replacement.
export function findTeamPhantimalHex(grid: Grid, team: Team): number | null {
  for (const tile of grid.getAllTiles()) {
    if (tile.team === team && tile.characterId !== undefined && isPhantimalId(tile.characterId)) {
      return tile.hex.getId()
    }
  }
  return null
}

export function canPlaceCharacterOnTile(grid: Grid, hexId: number, team: Team): boolean {
  const tile = grid.getTileById(hexId)
  const state = tile.state
  const availableState = team === Team.ALLY ? State.AVAILABLE_ALLY : State.AVAILABLE_ENEMY
  const occupiedState = team === Team.ALLY ? State.OCCUPIED_ALLY : State.OCCUPIED_ENEMY

  return state === availableState || state === occupiedState
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

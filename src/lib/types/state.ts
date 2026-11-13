import { Team } from './team'

// Grid tile states
export enum State {
  DEFAULT = 0,
  AVAILABLE_ALLY = 1, // Available for placement for ally
  AVAILABLE_ENEMY = 2, // Available for placement for enemy
  OCCUPIED_ALLY = 3, // Occupied by ally unit
  OCCUPIED_ENEMY = 4, // Occupied by enemy unit
  BLOCKED = 5, // Blocked by obstacle
  BLOCKED_BREAKABLE = 6, // Blocked by breakable obstacle
}

// The side a tile belongs to, as a deployment tile or through the unit on it.
export const getTeamFromTileState = (state: State): Team | null => {
  if (state === State.AVAILABLE_ALLY || state === State.OCCUPIED_ALLY) return Team.ALLY
  if (state === State.AVAILABLE_ENEMY || state === State.OCCUPIED_ENEMY) return Team.ENEMY
  return null
}

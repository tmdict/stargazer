import {
  findCharacterHex,
  getCharacter,
  getCharacterTeam,
  hasCharacter,
} from '../../characters/character'
import { getMainCharacterId, isCompanionId } from '../../characters/companion'
import { performPlace } from '../../characters/place'
import { performRemove } from '../../characters/remove'
import { State } from '../../types/state'
import { Team } from '../../types/team'
import { hasSkill, registerSkill } from '../registry'
import { type Skill, type SkillContext } from '../skill'

// Tile IDs that become BLOCKED/BREAKABLE per team
const ALLY_AFFECTED = { blocked: [18, 19, 20, 21, 22, 24], breakable: [23] }
const ENEMY_AFFECTED = { blocked: [25, 26, 27, 28, 22, 24], breakable: [23] }

function getAffectedConfig(team: Team) {
  return team === Team.ALLY ? ALLY_AFFECTED : ENEMY_AFFECTED
}

function getAllAffectedIds(team: Team): number[] {
  const config = getAffectedConfig(team)
  return [...config.blocked, ...config.breakable]
}

// Convert OCCUPIED states to their AVAILABLE equivalents for restoration
function getRestorableState(state: State): State {
  if (state === State.OCCUPIED_ALLY) return State.AVAILABLE_ALLY
  if (state === State.OCCUPIED_ENEMY) return State.AVAILABLE_ENEMY
  return state
}

// Store original tile states per team for restoration on deactivation
const savedTileStates = new Map<Team, Map<number, State>>()

// Remove a character from a tile, deactivating its skill if active
function removeCharacterFromAffectedTile(
  { grid, skillManager }: SkillContext,
  hexId: number,
  kuluCharacterId: number,
): void {
  const charId = getCharacter(grid, hexId)
  const charTeam = getCharacterTeam(grid, hexId)
  if (!charId || !charTeam || charId === kuluCharacterId) return

  // If companion, remove the main character instead (cascades to companions)
  if (isCompanionId(grid, charId)) {
    const mainCharId = getMainCharacterId(grid, charId)
    const mainHexId = findCharacterHex(grid, mainCharId, charTeam)
    if (mainHexId !== null) {
      if (hasSkill(mainCharId)) {
        skillManager.deactivateCharacterSkill(mainCharId, mainHexId, charTeam, grid)
      }
      if (hasCharacter(grid, mainHexId)) {
        performRemove(grid, mainHexId, true)
      }
    }
    // Companion may already be removed by skill deactivation; clean up if not
    if (hasCharacter(grid, hexId)) {
      performRemove(grid, hexId, true)
    }
    return
  }

  // Regular character
  if (hasSkill(charId)) {
    skillManager.deactivateCharacterSkill(charId, hexId, charTeam, grid)
  }
  if (hasCharacter(grid, hexId)) {
    performRemove(grid, hexId, true)
  }
}

const kuluSkill: Skill = {
  id: 'kulu',
  characterId: 80,
  name: 'Demolition Zone',
  description:
    'Creates a demolition zone that blocks nearby tiles. Characters on affected tiles are removed. The zone is cleared when Kulu leaves the battlefield',

  onActivate(context: SkillContext): void {
    const { grid, hexId, team, characterId } = context
    const affectedIds = getAllAffectedIds(team)
    const config = getAffectedConfig(team)
    const kuluOnAffectedTile = affectedIds.includes(hexId)

    // Pre-check: if kulu needs relocation, verify there's somewhere to go
    if (kuluOnAffectedTile) {
      const affectedSet = new Set(affectedIds)
      const availableState = team === Team.ALLY ? State.AVAILABLE_ALLY : State.AVAILABLE_ENEMY
      const hasRelocationTarget = grid
        .getAllTiles()
        .some(
          (tile) =>
            tile.state === availableState &&
            !tile.characterId &&
            !affectedSet.has(tile.hex.getId()),
        )
      if (!hasRelocationTarget) {
        throw new Error('No available tile for kulu relocation')
      }
    }

    // Save original tile states (convert OCCUPIED to AVAILABLE for restoration)
    const saved = new Map<number, State>()
    for (const id of affectedIds) {
      const tile = grid.getTileById(id)
      saved.set(id, getRestorableState(tile.state))
    }
    savedTileStates.set(team, saved)

    // Remove characters from affected tiles (except kulu)
    for (const id of affectedIds) {
      removeCharacterFromAffectedTile(context, id, characterId)
    }

    // Set affected tiles to BLOCKED / BREAKABLE
    for (const id of config.blocked) {
      grid.setState(grid.getHexById(id), State.BLOCKED)
    }
    for (const id of config.breakable) {
      grid.setState(grid.getHexById(id), State.BLOCKED_BREAKABLE)
    }

    // Relocate kulu if she was on an affected tile
    if (kuluOnAffectedTile) {
      const availableState = team === Team.ALLY ? State.AVAILABLE_ALLY : State.AVAILABLE_ENEMY
      const availableTiles = grid
        .getAllTiles()
        .filter((tile) => tile.state === availableState && !tile.characterId)

      if (availableTiles.length === 0) {
        // Shouldn't happen due to pre-check, but handle gracefully
        throw new Error('No available tile for kulu relocation')
      }

      const randomIndex = Math.floor(Math.random() * availableTiles.length)
      const newHexId = availableTiles[randomIndex]!.hex.getId()

      performRemove(grid, hexId, true)
      performPlace(grid, newHexId, characterId, team, true)
    }
  },

  onDeactivate(context: SkillContext): void {
    const { grid, team } = context
    const saved = savedTileStates.get(team)
    if (!saved) return

    // Restore all modified tiles to their original states
    for (const [hexId, originalState] of saved) {
      grid.setState(grid.getHexById(hexId), originalState)
    }

    savedTileStates.delete(team)
  },
}

registerSkill(kuluSkill)

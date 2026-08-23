import type { Grid } from '../grid'
import { hasCompanionSkill, hasSkill, SkillManager } from '../skills/skill'
import { State } from '../types/state'
import { Team } from '../types/team'
import {
  canPlaceCharacterOnTeam,
  canPlaceCharacterOnTile,
  findCharacterHex,
  getAllAvailableTilesForTeam,
  getAvailableTeamSize,
  getCharacter,
  getCharacterTeam,
  hasCharacter,
  isCharacterOnTeam,
  resolvePlacement,
  synergySlotFree,
} from './character'
import {
  getMainCharacterId,
  isCompanionId,
  restoreCompanions,
  storeCompanionPositions,
} from './companion'
import { isPhantimalId } from './phantimal'
import { isPlaceholderId } from './placeholder'
import { performRemove } from './remove'
import { isSynergyHeroId, toSynergyId } from './synergy'
import { executeTransaction } from './transaction'

// High-level operations

export function executePlaceCharacter(
  grid: Grid,
  skillManager: SkillManager,
  hexId: number,
  characterId: number,
  team: Team = Team.ALLY,
): boolean {
  // Companions cannot be placed directly (only created via skills)
  if (isCompanionId(grid, characterId)) {
    return false
  }

  // Placing onto an occupied tile replaces the occupant, with full skill
  // cleanup. The unit to remove is anchored on the main character: a companion
  // occupant cascades to its main (removing either removes the whole unit,
  // matching executeRemoveCharacter's semantics).
  const occupantId = getCharacter(grid, hexId)
  const occupantTeam = getCharacterTeam(grid, hexId)
  let anchorId = occupantId
  let anchorHex = hexId
  if (occupantId !== undefined && occupantTeam !== undefined && isCompanionId(grid, occupantId)) {
    const mainCharId = getMainCharacterId(grid, occupantId)
    const mainHexId = findCharacterHex(grid, mainCharId, occupantTeam)
    if (mainHexId !== null) {
      anchorId = mainCharId
      anchorHex = mainHexId
    }
  }

  let occupantCompanions: ReturnType<typeof storeCompanionPositions> = []
  let occupantSkillDeactivated = false
  let occupantRemoved = false
  let placed = false

  const result = executeTransaction(
    [
      // Step 1: Clear the occupant (if any) with full skill cleanup
      () => {
        if (anchorId === undefined || occupantTeam === undefined) return true
        occupantCompanions = storeCompanionPositions(grid, anchorId, occupantTeam)
        if (skillManager.hasActiveSkill(anchorId, occupantTeam)) {
          skillManager.deactivateCharacterSkill(anchorId, anchorHex, occupantTeam, grid)
          occupantSkillDeactivated = true
        }
        if (hasCharacter(grid, anchorHex)) {
          occupantRemoved = performRemove(grid, anchorHex)
          if (!occupantRemoved) return false
        }
        // The target tile must be free now (a companion occupant is removed
        // by its main's skill deactivation)
        return !hasCharacter(grid, hexId)
      },
      // Step 2: Place character
      () => {
        placed = performPlace(grid, hexId, characterId, team)
        return placed
      },
      // Step 3: Activate skill if character has one
      () => {
        if (!hasSkill(characterId)) return true
        return skillManager.activateCharacterSkill(characterId, hexId, team, grid)
      },
    ],
    [
      // Rollback: remove the new character first, then restore the occupant:
      // re-place, re-activate its skill, and return companions to their tiles
      () => {
        if (placed && hasCharacter(grid, hexId)) {
          if (!performRemove(grid, hexId)) {
            console.warn(`Failed to rollback character placement at hex ${hexId}`)
          }
        }
        if (anchorId === undefined || occupantTeam === undefined) return
        if (occupantRemoved) {
          performPlace(grid, anchorHex, anchorId, occupantTeam)
        }
        if (occupantSkillDeactivated) {
          skillManager.activateCharacterSkill(anchorId, anchorHex, occupantTeam, grid)
          if (hasCompanionSkill(anchorId)) {
            restoreCompanions(grid, skillManager, anchorId, occupantCompanions)
          }
        }
      },
    ],
  )

  // Trigger skill updates after successful transaction
  if (result && grid.skillManager) {
    grid.skillManager.updateActiveSkills(grid)
  }

  return result
}

// Which id a roster drop of baseId onto targetHexId should place, or null. An
// occupied target is a replace, so the pick is judged against the post-vacate
// board: the occupant's anchor (a companion cascades to its main, as in
// executePlaceCharacter) gives back what it holds first. A base hero or
// placeholder frees a capacity slot, the synergy hero frees the assist slot, a
// phantimal frees nothing. The drop gate and the drop handler both consume
// this, so hover cues and drops can't disagree.
export function resolveReplacement(
  grid: Grid,
  baseId: number,
  team: Team,
  targetHexId: number,
  synergyOn: boolean,
): number | null {
  const occupantId = getCharacter(grid, targetHexId)
  if (occupantId === undefined) return resolvePlacement(grid, baseId, team, synergyOn)

  const anchorId = getMainCharacterId(grid, occupantId)
  const freesSlot = isSynergyHeroId(anchorId)
  const freesCapacity = !freesSlot && !isPhantimalId(anchorId)
  // The vacating hero no longer counts as a duplicate of itself.
  const duplicate =
    anchorId !== baseId && !isPlaceholderId(baseId) && isCharacterOnTeam(grid, baseId, team)

  let resolved: number | null = null
  if ((freesCapacity || getAvailableTeamSize(grid, team) > 0) && !duplicate) {
    resolved = baseId
  } else if (synergyOn && (freesSlot || synergySlotFree(grid, team))) {
    resolved = toSynergyId(baseId)
  }
  // Re-placing the occupant itself is a no-op; reporting null here keeps the
  // page-wide uniqueness check at the call sites (which would see the vacating
  // occupant as a use) in agreement with the engine.
  return resolved === anchorId ? null : resolved
}

export function executeAutoPlaceCharacter(
  grid: Grid,
  skillManager: SkillManager,
  characterId: number,
  team: Team,
): boolean {
  if (!canPlaceCharacterOnTeam(grid, characterId, team)) return false

  const availableTiles = getAllAvailableTilesForTeam(grid, team)
  if (availableTiles.length == 0) return false

  const randomIndex = Math.floor(Math.random() * availableTiles.length)
  const selectedTile = availableTiles[randomIndex]

  if (!selectedTile) {
    console.error(
      'executeAutoPlaceCharacter: Selected tile is undefined despite non-empty availableTiles array',
      {
        randomIndex,
        availableTilesLength: availableTiles.length,
      },
    )
    return false
  }

  const hexId = selectedTile.hex.getId()

  const placed = performPlace(grid, hexId, characterId, team)
  if (!placed) return false

  if (hasSkill(characterId)) {
    const activated = skillManager.activateCharacterSkill(characterId, hexId, team, grid)

    if (!activated) {
      if (!performRemove(grid, hexId)) {
        console.warn(
          `Failed to remove character ${characterId} from hex ${hexId} after skill activation failure`,
        )
      }
      return false
    }
  }

  // Trigger skill updates after successful placement
  if (grid.skillManager) {
    grid.skillManager.updateActiveSkills(grid)
  }

  return true
}

// Atomic operations

export function performPlace(
  grid: Grid,
  hexId: number,
  characterId: number,
  team: Team = Team.ALLY,
): boolean {
  if (!Number.isInteger(characterId) || characterId <= 0) return false

  if (!canPlaceCharacterOnTile(grid, hexId, team)) return false
  if (!canPlaceCharacterOnTeam(grid, characterId, team)) return false

  const tile = grid.getTileById(hexId)

  // The atomic primitive never displaces an existing unit: replacement is the
  // skill-aware composite in executePlaceCharacter, swaps clear both tiles first
  if (tile.characterId) return false

  tile.characterId = characterId
  tile.team = team
  tile.state = team === Team.ALLY ? State.OCCUPIED_ALLY : State.OCCUPIED_ENEMY

  return true
}

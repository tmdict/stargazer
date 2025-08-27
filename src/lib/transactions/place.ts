import { hasCharacter } from '../character'
import type { Grid } from '../grid'
import { hasSkill, SkillManager } from '../skill'
import { Team } from '../types/team'
import { performRemove } from './remove'
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
  if (grid.isCompanionId(characterId)) {
    return false
  }

  let placed = false

  const result = executeTransaction(
    [
      // Place character
      () => {
        placed = grid.placeCharacter(hexId, characterId, team, true)
        return placed
      },
      // Activate skill if character has one
      () => {
        if (!hasSkill(characterId)) return true
        return skillManager.activateCharacterSkill(characterId, hexId, team, grid)
      },
    ],
    [
      // Rollback: remove character if it was placed
      () => {
        if (placed && hasCharacter(grid, hexId)) {
          if (!performRemove(grid, hexId, true)) {
            console.warn(`Failed to rollback character placement at hex ${hexId}`)
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

export function executeAutoPlaceCharacter(
  grid: Grid,
  skillManager: SkillManager,
  characterId: number,
  team: Team,
): boolean {
  // Validate character can be placed
  if (!grid.canPlaceCharacterOnTeam(characterId, team)) return false

  // Get all available tiles for this team
  const availableTiles = grid.getAllAvailableTilesForTeam(team)
  if (availableTiles.length == 0) return false

  // Sort by hex ID descending (largest first) for deterministic randomness
  availableTiles.sort((a, b) => b.hex.getId() - a.hex.getId())

  // Select random tile from available options
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

  // Place character
  const placed = grid.placeCharacter(hexId, characterId, team, true)
  if (!placed) return false

  // Activate skill if character has one
  if (hasSkill(characterId)) {
    const activated = skillManager.activateCharacterSkill(characterId, hexId, team, grid)

    if (!activated) {
      // Clean up on skill failure
      if (!performRemove(grid, hexId, true)) {
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

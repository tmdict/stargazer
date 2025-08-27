import { findCharacterHex } from '../character'
import type { Grid } from '../grid'
import { getCharacterSkill, SkillManager } from '../skill'
import { Team } from '../types/team'

export interface CompanionPosition {
  companionId: number
  hexId: number
  team: Team
  mainCharId: number
}

// Stores companion positions before skill deactivation
export function storeCompanionPositions(
  grid: Grid,
  characterId: number,
  team: Team,
): CompanionPosition[] {
  const positions: CompanionPosition[] = []
  const companions = grid.getCompanions(characterId, team)

  companions.forEach((companionId) => {
    const hexId = findCharacterHex(grid, companionId, team)
    if (hexId !== null) {
      positions.push({
        companionId,
        hexId,
        team,
        mainCharId: characterId,
      })
    }
  })

  return positions
}

// Restores companions to original positions
export function restoreCompanions(
  grid: Grid,
  skillManager: SkillManager,
  mainCharId: number,
  companionPositions: CompanionPosition[],
): void {
  companionPositions
    .filter((pos) => pos.mainCharId === mainCharId)
    .forEach(({ companionId, hexId: originalHexId, team }) => {
      const currentHexId = findCharacterHex(grid, companionId, team)
      if (currentHexId !== null && currentHexId !== originalHexId) {
        // Remove from current position
        if (!grid.removeCharacter(currentHexId, true)) {
          console.warn(
            `Failed to remove companion ${companionId} from hex ${currentHexId} during restoration`,
          )
        }
        // Place at original position
        grid.placeCharacter(originalHexId, companionId, team, true)
        // Re-add color modifier (use companion color for companions)
        const skill = getCharacterSkill(mainCharId)
        if (skill?.companionColorModifier) {
          skillManager.addCharacterColorModifier(companionId, team, skill.companionColorModifier)
        }
      }
    })
}

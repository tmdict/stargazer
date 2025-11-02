import { findCharacterHex, getMaxTeamSize, setMaxTeamSize } from '../characters/character'
import { addCompanionLink, clearCompanionLinks, getCompanions } from '../characters/companion'
import { performPlace } from '../characters/place'
import { performRemove } from '../characters/remove'
import { State } from '../types/state'
import { Team } from '../types/team'
import type { Skill, SkillContext } from './skill'

export const zanieSkill: Skill = {
  id: 'zanie',
  characterId: 89,
  name: 'Turret',
  description:
    'Places 2 turrets on the map, increasing team capacity by 2. If either Zanie or her turrets are removed, all are removed. Each turret has a range of 3',
  companionImageModifier: 'zanie-turret',
  companionRange: 3,

  onActivate(context: SkillContext): void {
    const { grid, team, characterId, skillManager } = context
    const companionIds = [10000 + characterId, 20000 + characterId] // Two turrets: 10089 and 20089

    // Find available tiles for companions
    const availableState = team === Team.ALLY ? State.AVAILABLE_ALLY : State.AVAILABLE_ENEMY
    let availableTiles = grid
      .getAllTiles()
      .filter((tile) => tile.state === availableState && !tile.characterId)

    if (availableTiles.length < 2) {
      // Not enough space for both companions - this should cause the entire placement to fail
      throw new Error('Not enough space available for both turrets')
    }

    // Increase team size by 2 to accommodate both companions
    const currentSize = getMaxTeamSize(grid, team)
    if (!setMaxTeamSize(grid, team, currentSize + 2)) {
      console.warn(`zanie: Failed to increase team size for ${team}`)
      return // Skip companion placement
    }

    // Place both turrets
    const placedCompanions: number[] = []
    let turretNumber = 0

    for (const companionId of companionIds) {
      turretNumber++

      // Pick a random available tile
      const randomIndex = Math.floor(Math.random() * availableTiles.length)
      const randomTile = availableTiles[randomIndex]
      if (!randomTile) {
        console.error(`zanie: No random tile found for turret ${turretNumber}`, {
          randomIndex,
          availableTilesLength: availableTiles.length,
        })
        // Rollback previous placements
        placedCompanions.forEach((placedId) => {
          const hexId = findCharacterHex(grid, placedId, team)
          if (hexId !== null) {
            performRemove(grid, hexId, true)
          }
        })
        // Rollback team size
        setMaxTeamSize(grid, team, currentSize)
        throw new Error(`Failed to find tile for turret ${turretNumber}`)
      }

      const companionHexId = randomTile.hex.getId()

      // Place the companion
      const placed = performPlace(grid, companionHexId, companionId, team, true)
      if (!placed) {
        // Rollback previous placements
        placedCompanions.forEach((placedId) => {
          const hexId = findCharacterHex(grid, placedId, team)
          if (hexId !== null) {
            performRemove(grid, hexId, true)
          }
        })
        // Rollback team size
        setMaxTeamSize(grid, team, currentSize)
        throw new Error(`Failed to place turret ${turretNumber}`)
      }

      placedCompanions.push(companionId)

      // Remove the used tile from available tiles
      availableTiles = availableTiles.filter((_, index) => index !== randomIndex)

      // Link the companion to the main character
      addCompanionLink(grid, characterId, companionId, team)

      // Register image modifier for this turret
      if (this.companionImageModifier) {
        skillManager.addCharacterImageModifier(companionId, team, this.companionImageModifier)
      }
    }

    // Register modifiers for main character
    if (this.colorModifier) {
      skillManager.addCharacterColorModifier(characterId, team, this.colorModifier)
    }
  },

  onDeactivate(context: SkillContext): void {
    const { grid, team, characterId, skillManager } = context

    // Get all companions for this character on this team
    const companions = getCompanions(grid, characterId, team)

    // Remove modifiers
    skillManager.removeCharacterColorModifier(characterId, team) // Remove main character modifier

    // Remove companions and their modifiers
    companions.forEach((companionId) => {
      const companionHex = findCharacterHex(grid, companionId, team)
      if (companionHex !== null) {
        skillManager.removeCharacterImageModifier(companionId, team)
        if (!performRemove(grid, companionHex, true)) {
          console.warn(`zanie: Failed to remove turret ${companionId} from hex ${companionHex}`)
        }
      }
    })

    // Clear companion links for this team
    clearCompanionLinks(grid, characterId, team)

    // Decrease team size back to normal (reduce by 2 for both turrets)
    const currentSize = getMaxTeamSize(grid, team)
    if (!setMaxTeamSize(grid, team, Math.max(5, currentSize - 2))) {
      console.warn(`zanie: Failed to restore team size for ${team}`)
    }
  },
}

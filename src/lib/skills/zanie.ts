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

  companionImageModifier: 'zanie-turret', // Custom companion image
  companionRange: 3, // Companion attack range

  onActivate(context: SkillContext): void {
    const { grid, team, characterId, skillManager } = context
    const companionId = 10000 + characterId // 10068 for Elijah & Lailah

    // Find a random available tile for the companion
    const availableState = team === Team.ALLY ? State.AVAILABLE_ALLY : State.AVAILABLE_ENEMY
    const availableTiles = grid
      .getAllTiles()
      .filter((tile) => tile.state === availableState && !tile.characterId)

    if (availableTiles.length === 0) {
      // No space for companion - this should cause the entire placement to fail
      throw new Error('No space available for companion')
    }

    // Pick a random available tile
    const randomIndex = Math.floor(Math.random() * availableTiles.length)
    const randomTile = availableTiles[randomIndex]
    if (!randomTile) {
      console.error('zanie: No random tile found despite non-empty array', {
        randomIndex,
        availableTilesLength: availableTiles.length,
      })
      return // Skip companion placement
    }
    const companionHexId = randomTile.hex.getId()

    // Increase team size by 1 to accommodate the companion
    const currentSize = getMaxTeamSize(grid, team)
    if (!setMaxTeamSize(grid, team, currentSize + 1)) {
      console.warn(`zanie: Failed to increase team size for ${team}`)
      return // Skip companion placement
    }

    // Place the companion
    const placed = performPlace(grid, companionHexId, companionId, team, true)
    if (!placed) {
      // Rollback team size if placement failed
      if (!setMaxTeamSize(grid, team, currentSize)) {
        console.error(`zanie: Critical - Failed to rollback team size for ${team}`)
      }
      throw new Error('Failed to place companion')
    }

    // Link the companion to the main character
    addCompanionLink(grid, characterId, companionId, team)

    // Register modifiers
    // Main character gets the main color
    if (this.colorModifier) {
      skillManager.addCharacterColorModifier(characterId, team, this.colorModifier)
    }
    // Companion gets the custom image modifier
    if (this.companionImageModifier) {
      skillManager.addCharacterImageModifier(companionId, team, this.companionImageModifier)
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
          console.warn(`zanie: Failed to remove companion ${companionId} from hex ${companionHex}`)
        }
      }
    })

    // Clear companion links for this team
    clearCompanionLinks(grid, characterId, team)

    // Decrease team size back to normal
    const currentSize = getMaxTeamSize(grid, team)
    if (!setMaxTeamSize(grid, team, Math.max(5, currentSize - 1))) {
      console.warn(`zanie: Failed to restore team size for ${team}`)
    }
  },
}

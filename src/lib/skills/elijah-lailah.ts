import type { Skill, SkillContext } from '../skill'
import { State } from '../types/state'
import { Team } from '../types/team'

export const elijahLailahSkill: Skill = {
  id: 'elijah-lailah',
  characterId: 68,
  name: 'Twins',
  description:
    'Elijah and Lailah appear as separate units on the map, increasing team capacity by 1. If either Elijah or Lailah is removed, both are removed. Lailah has a range of 1',

  colorModifier: '#6ca3a0', // Light blue for main unit (Elijah)
  companionColorModifier: '#cd7169', // Light pink for companion unit (Lailah)
  companionRange: 1, // Lailah has range of 1

  onActivate(context: SkillContext): void {
    const { grid, team, characterId, skillManager, hexId } = context
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
    const randomTile = availableTiles[Math.floor(Math.random() * availableTiles.length)]
    const companionHexId = randomTile.hex.getId()

    // Increase team size by 1 to accommodate the companion
    const currentSize = grid.getMaxTeamSize(team)
    grid.setMaxTeamSize(team, currentSize + 1)

    // Place the companion
    const placed = grid.placeCharacter(companionHexId, companionId, team, true)
    if (!placed) {
      // Rollback team size if placement failed
      grid.setMaxTeamSize(team, currentSize)
      throw new Error('Failed to place companion')
    }

    // Link the companion to the main character
    grid.addCompanionLink(characterId, companionId, team)

    // Register color modifiers
    // Main character gets the main color
    if (this.colorModifier) {
      skillManager.addCharacterColorModifier(characterId, team, this.colorModifier)
    }
    // Companion gets the companion color
    if (this.companionColorModifier) {
      skillManager.addCharacterColorModifier(companionId, team, this.companionColorModifier)
    }
  },

  onDeactivate(context: SkillContext): void {
    const { grid, team, characterId, skillManager, hexId } = context

    // Get all companions for this character on this team
    const companions = grid.getCompanions(characterId, team)

    // Remove color modifiers
    skillManager.removeCharacterColorModifier(characterId, team) // Remove main character modifier

    // Remove companions and their color modifiers
    companions.forEach((companionId) => {
      const companionHex = grid.findCharacterHex(companionId, team)
      if (companionHex !== null) {
        skillManager.removeCharacterColorModifier(companionId, team)
        grid.removeCharacter(companionHex, true)
      }
    })

    // Clear companion links for this team
    grid.clearCompanionLinks(characterId, team)

    // Decrease team size back to normal
    const currentSize = grid.getMaxTeamSize(team)
    grid.setMaxTeamSize(team, Math.max(5, currentSize - 1))
  },
}

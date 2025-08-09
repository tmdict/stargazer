import type { Grid } from './grid'
import type { Team } from './types/team'
import { elijahLailahSkill } from './skills/elijah-lailah'
import { phraestoSkill } from './skills/phraesto'

export interface SkillContext {
  grid: Grid
  hexId: number
  team: Team
  characterId: number
  skillManager: SkillManager
}

export interface Skill {
  id: string
  characterId: number
  name: string
  description: string
  colorModifier?: string // Border color for visual effects (main unit)
  companionColorModifier?: string // Border color for companion units
  companionRange?: number // Override range for companion units

  onActivate(context: SkillContext): void
  onDeactivate(context: SkillContext): void
  
  // Optional lifecycle method called when any character moves or grid state changes
  // Useful for skills that need to recalculate targets or update visual indicators
  onUpdate?(context: SkillContext): void
}

// Skill registry
const skillRegistry = new Map<number, Skill>([
  [phraestoSkill.characterId, phraestoSkill],
  [elijahLailahSkill.characterId, elijahLailahSkill],
])

export function getCharacterSkill(characterId: number): Skill | undefined {
  return skillRegistry.get(characterId)
}

export function hasSkill(characterId: number): boolean {
  return skillRegistry.has(characterId)
}

// SkillManager class for managing active skills
export class SkillManager {
  // Track which characters have active skills on which hexes
  // Key is "characterId-team" to allow same character on different teams
  private activeSkills: Record<string, { characterId: number; hexId: number; team: Team }> = {}
  // Track color modifiers for specific characters (for companions)
  // Key is "characterId-team" to support same companion ID on different teams
  private characterColorModifiers: Record<string, string> = {}

  private getSkillKey(characterId: number, team: Team): string {
    return `${characterId}-${team}`
  }

  hasActiveSkill(characterId: number, team?: Team): boolean {
    if (team !== undefined) {
      return this.getSkillKey(characterId, team) in this.activeSkills
    }
    // Check if character has skill on any team
    for (const info of Object.values(this.activeSkills)) {
      if (info.characterId === characterId) return true
    }
    return false
  }

  getActiveSkillInfo(characterId: number, team?: Team): { hexId: number; team: Team } | undefined {
    if (team !== undefined) {
      const info = this.activeSkills[this.getSkillKey(characterId, team)]
      return info ? { hexId: info.hexId, team: info.team } : undefined
    }
    // Find skill info for character on any team
    for (const info of Object.values(this.activeSkills)) {
      if (info.characterId === characterId) {
        return { hexId: info.hexId, team: info.team }
      }
    }
    return undefined
  }

  activateCharacterSkill(characterId: number, hexId: number, team: Team, grid: Grid): boolean {
    // Check if character has a skill
    const skill = getCharacterSkill(characterId)
    if (!skill) return true // No skill to activate, consider it success

    const skillKey = this.getSkillKey(characterId, team)

    // If already active on THIS team, deactivate first
    if (this.hasActiveSkill(characterId, team)) {
      this.deactivateCharacterSkill(characterId, hexId, team, grid)
    }

    // Track the active skill
    this.activeSkills[skillKey] = { characterId, hexId, team }

    // Create context and activate
    const context: SkillContext = {
      grid,
      hexId,
      team,
      characterId,
      skillManager: this,
    }

    try {
      skill.onActivate(context)
      return true
    } catch (error) {
      // Rollback tracking on failure
      delete this.activeSkills[skillKey]
      return false
    }
  }

  deactivateCharacterSkill(characterId: number, hexId: number, team: Team, grid: Grid): void {
    const skill = getCharacterSkill(characterId)
    if (!skill) {
      return
    }

    const skillKey = this.getSkillKey(characterId, team)

    // Remove from tracking
    delete this.activeSkills[skillKey]

    // Create context and deactivate
    const context: SkillContext = {
      grid,
      hexId,
      team,
      characterId,
      skillManager: this,
    }

    skill.onDeactivate(context)
  }

  // Clear all active skills (used when clearing all characters)
  deactivateAllSkills(grid: Grid): void {
    // Create a copy to iterate over since we'll be modifying the object
    const activeSkillsCopy = { ...this.activeSkills }

    Object.values(activeSkillsCopy).forEach(({ characterId, hexId, team }) => {
      this.deactivateCharacterSkill(characterId, hexId, team, grid)
    })
  }

  // Add color modifier for a specific character (used by skills for companions)
  addCharacterColorModifier(characterId: number, team: Team, color: string): void {
    const key = this.getSkillKey(characterId, team)
    this.characterColorModifiers[key] = color
  }

  // Remove color modifier for a specific character
  removeCharacterColorModifier(characterId: number, team: Team): void {
    const key = this.getSkillKey(characterId, team)
    delete this.characterColorModifiers[key]
  }

  // Clear all character color modifiers
  clearCharacterColorModifiers(): void {
    this.characterColorModifiers = {}
  }

  // Get color modifiers mapped by "characterId-team"
  getColorModifiersByCharacterAndTeam(): Map<string, string> {
    const modifiers = new Map<string, string>()

    // Add modifiers from active skills (main characters)
    Object.entries(this.activeSkills).forEach(([key, { characterId }]) => {
      const skill = getCharacterSkill(characterId)
      if (skill?.colorModifier) {
        modifiers.set(key, skill.colorModifier)
      }
    })

    // Add character-specific modifiers (companions)
    Object.entries(this.characterColorModifiers).forEach(([key, color]) => {
      modifiers.set(key, color)
    })

    return modifiers
  }
}

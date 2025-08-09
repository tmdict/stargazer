import type { Grid } from './grid'
import type { Team } from './types/team'
import { elijahLailahSkill } from './skills/elijah-lailah'
import { phraestoSkill } from './skills/phraesto'
import { silvinaSkill } from './skills/silvina'

export interface SkillContext {
  grid: Grid
  hexId: number
  team: Team
  characterId: number
  skillManager: SkillManager
}

export interface SkillTargetInfo {
  targetHexId: number | null
  targetCharacterId: number | null
  metadata?: Record<string, any>
}

export interface Skill {
  id: string
  characterId: number
  name: string
  description: string
  colorModifier?: string // Border color for visual effects (main unit)
  targetingColorModifier?: string // Arrow color for targeting skills
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
  [silvinaSkill.characterId, silvinaSkill],
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
  // Track skill targeting information
  private skillTargets: Map<string, SkillTargetInfo> = new Map()
  // Version counter to trigger reactivity
  private targetVersion = 0

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

  // Skill targeting methods
  setSkillTarget(characterId: number, team: Team, target: SkillTargetInfo): void {
    const key = this.getSkillKey(characterId, team)
    this.skillTargets.set(key, target)
    this.targetVersion++ // Trigger reactivity
  }

  getSkillTarget(characterId: number, team: Team): SkillTargetInfo | undefined {
    const key = this.getSkillKey(characterId, team)
    return this.skillTargets.get(key)
  }

  clearSkillTarget(characterId: number, team: Team): void {
    const key = this.getSkillKey(characterId, team)
    this.skillTargets.delete(key)
    this.targetVersion++ // Trigger reactivity
  }

  getAllSkillTargets(): Map<string, SkillTargetInfo> {
    return new Map(this.skillTargets)
  }
  
  getTargetVersion(): number {
    return this.targetVersion
  }

  // Update all active skills
  updateActiveSkills(grid: Grid): void {
    for (const [key, info] of Object.entries(this.activeSkills)) {
      const skill = getCharacterSkill(info.characterId)
      
      // Find the character's current position
      const currentHexId = grid.findCharacterHex(info.characterId, info.team)
      if (!currentHexId) {
        // Character no longer on grid, deactivate skill
        delete this.activeSkills[key]
        continue
      }
      
      // Update stored position if it changed
      if (info.hexId !== currentHexId) {
        info.hexId = currentHexId
      }
      
      if (skill?.onUpdate) {
        const context: SkillContext = {
          grid,
          hexId: currentHexId,
          team: info.team,
          characterId: info.characterId,
          skillManager: this,
        }
        skill.onUpdate(context)
      }
    }
  }
}

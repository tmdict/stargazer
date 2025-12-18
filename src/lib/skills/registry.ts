// Minimal skill interface for registry - just the fields needed for registration and lookup
// Uses 'any' for context to allow the full Skill type with SkillContext to be registered
export interface SkillBase {
  id: string
  characterId: number
  name: string
  description: string
  colorModifier?: string
  companionImageModifier?: string
  companionColorModifier?: string
  targetingColorModifier?: string
  tileColorModifier?: string
  companionRange?: number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onActivate: (context: any) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onDeactivate: (context: any) => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onUpdate?: (context: any) => void
}

// Skill registry - populated by self-registering skill modules
const skillRegistry = new Map<number, SkillBase>()

export function registerSkill(skill: SkillBase): void {
  skillRegistry.set(skill.characterId, skill)
}

export function getCharacterSkill(characterId: number): SkillBase | undefined {
  return skillRegistry.get(characterId)
}

export function hasSkill(characterId: number): boolean {
  return skillRegistry.has(characterId)
}

export function hasCompanionSkill(characterId: number): boolean {
  const skill = getCharacterSkill(characterId)
  return skill?.companionColorModifier !== undefined || skill?.companionImageModifier !== undefined
}

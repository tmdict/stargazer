// Generic skill interface - Context is parameterized to avoid circular dep with SkillContext in skill.ts
export interface SkillBase<Context = unknown> {
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
  onActivate: (context: Context) => void
  onDeactivate: (context: Context) => void
  onUpdate?: (context: Context) => void
}

// Registry stores SkillBase<unknown>, typed wrappers in skill.ts provide type safety
const skillRegistry = new Map<number, SkillBase<unknown>>()

export function registerSkill<Context>(skill: SkillBase<Context>): void {
  skillRegistry.set(skill.characterId, skill as SkillBase<unknown>)
}

export function getCharacterSkill<Context = unknown>(
  characterId: number,
): SkillBase<Context> | undefined {
  return skillRegistry.get(characterId) as SkillBase<Context> | undefined
}

export function hasSkill(characterId: number): boolean {
  return skillRegistry.has(characterId)
}

export function hasCompanionSkill(characterId: number): boolean {
  const skill = getCharacterSkill(characterId)
  return skill?.companionColorModifier !== undefined || skill?.companionImageModifier !== undefined
}

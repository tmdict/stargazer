import { decomposeUnitId } from '../characters/synergy'

// Generic skill interface - Context is parameterized to avoid circular dep with SkillContext in skill.ts
export interface SkillBase<Context = unknown> {
  id: string
  characterId: number
  colorModifier?: string
  companionImageModifier?: string
  companionColorModifier?: string
  targetingColorModifier?: string
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
  // A synergy copy runs its base hero's skill; instance state stays keyed by
  // the placed id at the call sites, only the definition lookup strips.
  return skillRegistry.get(decomposeUnitId(characterId).localId) as SkillBase<Context> | undefined
}

export function hasSkill(characterId: number): boolean {
  return skillRegistry.has(decomposeUnitId(characterId).localId)
}

// Test enumeration point for registry-wide contract tests.
export function getRegisteredSkills(): ReadonlyArray<SkillBase<unknown>> {
  return [...skillRegistry.values()]
}

export function hasCompanionSkill(characterId: number): boolean {
  const skill = getCharacterSkill(characterId)
  return skill?.companionColorModifier !== undefined || skill?.companionImageModifier !== undefined
}

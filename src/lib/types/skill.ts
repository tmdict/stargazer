// Slot order matches in-game order and is also the render order in SkillSections.
export const SLOT_ORDER = ['ultimate', 'skill2', 'skill3', 'mastery', 'ex', 'awakening'] as const

export type SlotKey = (typeof SLOT_ORDER)[number]

export type TagAttachment = { readonly [K in SlotKey]?: number }

// Empty attachment array = character-level tag (no per-level pin). Readonly so
// the type aligns with Vite's deeply-frozen JSON imports.
export type CharacterTags = Readonly<Record<string, readonly TagAttachment[]>>

// On-disk shape of src/locales/skill/<lang>/<slug>.json (auto-managed by the
// importer). `n` is omitted for slots whose name is invariant across heroes
// (mastery, awakening) — those names live in app locales.
export interface SkillLocaleSlot {
  n?: string | null
  d: string[]
}

export type SkillLocaleFile = Partial<Record<SlotKey, SkillLocaleSlot>>

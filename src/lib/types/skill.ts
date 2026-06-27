// Slot order matches in-game order and is also the render order in SkillSections.
export const SLOT_ORDER = ['ultimate', 'skill2', 'skill3', 'mastery', 'ex', 'awakening'] as const

export type SlotKey = (typeof SLOT_ORDER)[number]

export type TagAttachment = { readonly [K in SlotKey]?: number }

// Empty attachment array = character-level tag (no per-level pin). Readonly so
// the type aligns with Vite's deeply-frozen JSON imports.
export type CharacterTags = Readonly<Record<string, readonly TagAttachment[]>>

// On-disk shape of src/locales/skill/<lang>/<slug>.json (auto-managed by the
// importer). `n` is omitted for slots whose name is invariant across heroes
// (mastery, awakening). Those names live in app locales. `r` carries EX
// refinement tiers (Refine 2, Refine 4) and is only emitted on the `ex` slot
// when the source data has them.
export interface SkillRefineEntry {
  t: number // tier: 2 or 4 in current data
  d: string // pre-rendered body text in the entry's locale
}

export interface SkillLocaleSlot {
  n?: string | null
  d: string[]
  r?: SkillRefineEntry[]
}

export type SkillLocaleFile = Partial<Record<SlotKey, SkillLocaleSlot>>

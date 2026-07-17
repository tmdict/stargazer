// Slot order matches in-game order and is also the render order in SkillSections.
export const SLOT_ORDER = ['ultimate', 'skill2', 'skill3', 'mastery', 'ex', 'awakening'] as const

export type SlotKey = (typeof SLOT_ORDER)[number]

export type TagAttachment = { readonly [K in SlotKey]?: number }

// Empty attachment array = character-level tag (no per-level pin). Readonly so
// the type aligns with Vite's deeply-frozen JSON imports.
export type CharacterTags = Readonly<Record<string, readonly TagAttachment[]>>

// On-disk shape of src/locales/skill/<lang>/<slug>.json (auto-managed by the
// importer). Skill content is entirely feed-sourced: every slot carries `n`,
// and `_terms` carries the game's official slot-type labels for the heading
// prefixes (chrome surfaces such as search-result labels keep app-locale
// labels instead). `r` carries EX refinement tiers (Refine 2, Refine 4) and
// is only emitted on the `ex` slot when the source data has them.
export interface SkillRefineEntry {
  t: number // tier: 2 or 4 in current data
  d: string // pre-rendered body text in the entry's locale
}

export interface SkillLocaleSlot {
  n?: string | null
  d: string[]
  r?: SkillRefineEntry[]
}

// `_hero` is the feed's localized hero display name: skill pages and the
// search index read it in every language (curated character locales stay on
// chrome surfaces and as search aliases). `_terms` is the game's official
// "Ultimate" / "Exclusive Equipment" labels in the file's language, used as
// heading prefixes for those slots.
export type SkillLocaleFile = {
  _hero?: { name: string }
  _terms?: { ultimate: string; ex: string }
} & Partial<Record<SlotKey, SkillLocaleSlot>>

// On-disk shape of src/locales/skill/<lang>/_keywords.json: glossary key →
// tooltip text in that language, resolving the `[[label|key]]` tokens in slot
// text. Lives beside the hero files so each language chunk carries its own
// glossary; the underscore keeps it out of the hero-slug namespace.
export type SkillKeywords = Record<string, string>

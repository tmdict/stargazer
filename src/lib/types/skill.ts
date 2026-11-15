import type { Rule } from './rule'

// Slot order matches in-game order and is also the render order in SkillSections.
export const SLOT_ORDER = ['ultimate', 'skill2', 'skill3', 'mastery', 'ex', 'awakening'] as const

export type SlotKey = (typeof SLOT_ORDER)[number]

// A tag pins a skill slot's level or, when it comes from the hero's charm, a
// charm tier (1-4).
export type TagPin = SlotKey | 'charm'

// One effect: where it is pinned and the modifiers that describe it. Two
// separate effects on one skill level are two attachments, so modifiers on the
// same attachment always belong to the same effect.
export type TagAttachment = { readonly [K in TagPin]?: number } & {
  readonly mods?: readonly string[]
}

// Readonly so the type aligns with Vite's deeply-frozen JSON imports.
export type CharacterTags = Readonly<Record<string, readonly TagAttachment[]>>

// A tag and the modifiers one of its attachments must all carry: what a tag
// filter, a chip and a tag link each stand for.
export interface TagPick {
  readonly tag: string
  readonly mods: readonly string[]
}

// On-disk shape of src/pack/text/skill/<lang>/<slug>.json, written by a pack
// update. Every slot carries `n`. `r` carries EX refinement tiers (Refine 2,
// Refine 4) and is present only on the `ex` slot of a hero that has them.
export interface SkillRefineEntry {
  t: number // tier: 2 or 4 in current data
  d: string // pre-rendered body text in the entry's locale
}

export interface SkillLocaleSlot {
  n?: string | null
  d: string[]
  r?: SkillRefineEntry[]
}

// `_hero` is the data pack's localized hero display name: skill pages and the
// search index read it in every language (curated character locales stay on
// chrome surfaces and as search aliases).
export type SkillLocaleFile = {
  _hero?: { name: string }
} & Partial<Record<SlotKey, SkillLocaleSlot>>

// On-disk shape of src/pack/text/skill/<lang>/_terms.json (written by the data
// export): the game's official "Ultimate" / "Exclusive Equipment" labels in
// that language, used as heading prefixes for those slots, and its skill-panel
// templates: cooldown ("Cooldown: {cooldown}\nInitial Cooldown: {initialCooldown}"),
// range ("Range: {range}"), the word a global range shows as, and initial
// energy ("Initial Energy: {energy}").
export interface SkillTerms {
  ultimate: string
  ex: string
  cooldown: string
  range: string
  rangeGlobal: string
  initialEnergy: string
}

// On-disk shape of src/pack/text/skill/numbers.json (written by a pack update):
// hero slug → slot → the numbers shown with that skill. Only displayable
// values are written, so the app renders whatever is present. Cooldowns are
// seconds, range is tiles.
export interface SlotValues {
  cooldown?: number
  initialCooldown?: number
  range?: number | 'global'
}

// The Lv1 values, plus per later level only the values that level changes.
export interface SlotNumbers extends SlotValues {
  levels?: Record<number, SlotValues>
}

export type SkillNumbers = Record<string, Partial<Record<SlotKey, SlotNumbers>>>

// On-disk shape of src/pack/text/skill/<lang>/_keywords.json: glossary key →
// tooltip text in that language, resolving the `[[label|key]]` tokens in slot
// text. Lives beside the hero files so each language chunk carries its own
// glossary; the underscore keeps it out of the hero-slug namespace.
export type SkillKeywords = Record<string, string>

// On-disk shape of src/pack/text/skill/<lang>/_charms.json (written by the data
// export): the current season's charm text, stored once per charm because one
// charm is shared by several heroes. `tiers` carries the localized tier labels
// in Elite → Mythic order; each charm id maps to its four tier descriptions in
// the same order. Rides the locale chunks like `_keywords.json`.
export interface SkillCharms {
  tiers: string[]
  charms: Record<string, string[]>
}

// On-disk shape of src/pack/text/skill/<lang>/_charm-types.json (written by a
// pack update): the season's charm types in the game's order, each with its
// name and its bonus lines. Absent once the
// season's charms are retired.
export type SkillCharmTypes = Record<string, { name: string; bonus: string[] }>

// On-disk shape of src/pack/text/skill/<lang>/_artifacts.json (written by a
// pack update): artifact name → its name and effect text in that language,
// `levels[i]` being level i+1. Covers the permanent and the seasonal set.
export type SkillArtifacts = Record<string, { name: string; levels: string[] }>

// On-disk shape of src/pack/text/skill/<lang>/_phantimals.json (written by a
// pack update): phantimal name → its name and skills in that language, each
// skill's `levels[i]` being level i+1. Absent once the season is retired.
export type SkillPhantimals = Record<
  string,
  { name: string; skills: { name: string; levels: string[] }[] }
>

// One language's chunk once loaded: its hero files by slug, and the
// per-language files beside them. `charms` is null while charms are retired;
// an absent charm type, artifact or phantimal file reads as empty.
export interface SkillLanguage {
  heroes: Record<string, SkillLocaleFile>
  terms: SkillTerms
  keywords: SkillKeywords
  charms: SkillCharms | null
  charmTypes: SkillCharmTypes
  artifacts: SkillArtifacts
  phantimals: SkillPhantimals
}

// On-disk shape of src/pack/text/skill/hero-charms.json (written by a pack
// update), one file for every language: each hero's season charm, the id its
// text is filed under in _charms.json. `types` is the hero's charm types in the
// game's order and `recommended` the one the game marks; a hero with no types
// has neither.
export interface HeroCharm {
  charm: string
  types?: string[]
  recommended?: string
}

export interface HeroCharms {
  heroes: Record<string, HeroCharm>
}

// On-disk shape of src/data/seasonal/charm/<id>.json, written by hand: a file
// exists only for a charm with tags or rules.
export interface CharmFile {
  id: string
  tags?: CharmTags
  rules?: readonly Rule[]
}

// A charm of the pack's hero list with the heroes sharing it, and its file's
// fields when it has one.
export interface CharmData extends CharmFile {
  heroes: string[]
}

// A charm's hand-written tags: tag → every tier (1-4) whose text carries the
// effect, and the modifiers that describe it. Each tier's text is complete on
// its own, unlike a skill level's upgrade line, so an effect a charm has from
// Elite lists all four. Joined to each sharing hero's tags at load time.
export interface CharmTag {
  readonly tiers: readonly number[]
  readonly mods?: readonly string[]
}

export type CharmTags = Readonly<Record<string, CharmTag>>

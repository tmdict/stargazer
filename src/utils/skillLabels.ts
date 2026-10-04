import { tagPick } from '@/lib/tags'
import type { AppLocale, SkillLocale } from '@/lib/types/i18n'
import type { SkillLocaleFile, SlotKey, SlotNumbers, SlotValues, TagPick } from '@/lib/types/skill'
import {
  getSkillFile,
  loadAppLocales,
  loadCharacterLocales,
  loadGameLocales,
} from '@/utils/dataLoader'
import { isHeroModifier, loadTagVocabulary } from '@/utils/tagData'

/** App-locale label for a key (tag name, slot prefix, etc.); falls back to the key. */
export function appLabel(key: string, lang: AppLocale): string {
  return loadAppLocales()[key]?.[lang] ?? key
}

/** A tag modifier's label; a hero's name as a modifier reads "<Hero> Synergy". */
export function modifierLabel(mod: string, lang: AppLocale): string {
  return isHeroModifier(mod)
    ? `${curatedHeroName(mod, lang)} ${appLabel('synergy', lang)}`
    : appLabel(mod, lang)
}

/** A tag with its modifiers: "Debuff", "Debuff (Global, Eryndor Synergy)". */
export function tagPickLabel(pick: TagPick, lang: AppLocale): string {
  const tag = appLabel(pick.tag, lang)
  if (pick.mods.length === 0) return tag
  return `${tag} (${pick.mods.map((mod) => modifierLabel(mod, lang)).join(', ')})`
}

/** A tag named by itself. One that shows as one entry includes its modifier
 * ("Ult (Opening)"). */
export function tagLabel(tag: string, lang: AppLocale): string {
  return tagPickLabel(tagPick(tag, loadTagVocabulary()), lang)
}

/** Game-locale label (faction, class, stat); falls back to the key. */
export function gameLabel(key: string, lang: AppLocale): string {
  return loadGameLocales()[key]?.[lang] ?? key
}

// Chrome labels for slot chips (search-result cards, the search overlay).
const SLOT_LABEL_KEY: Record<SlotKey, string> = {
  ultimate: 'ultimate',
  skill2: 'skill-2',
  skill3: 'skill-3',
  mastery: 'hero-focus',
  ex: 'ex-skill',
  awakening: 'enhance-force',
}

export function slotLabel(slot: SlotKey, lang: AppLocale): string {
  return appLabel(SLOT_LABEL_KEY[slot], lang)
}

/** Hero display name in a skill-text language: the feed's `_hero.name` in
 * every language (falling back to the curated en name, then the slug). The
 * single copy of this fallback chain, shared by the skill header, search
 * index, and page meta. Curated character-locale names stay on chrome
 * surfaces (hero list, search-result cards) and as search aliases. */
export function heroDisplayName(slug: string, lang: SkillLocale): string {
  return getSkillFile(lang, slug)?._hero?.name ?? loadCharacterLocales()[slug]?.en ?? slug
}

/** Curated chrome-locale hero name, for surfaces that speak the app language
 * (the Mechanics guide, search-overlay alt text and recents, result ordering). */
export function curatedHeroName(slug: string, lang: AppLocale): string {
  return loadCharacterLocales()[slug]?.[lang] ?? slug
}

// Heading composition per slot. Skill content is feed-sourced end to end:
// names come from each slot's `n` and the ultimate/ex prefixes from the
// file's `_terms` (the game's official slot-type labels). The app-locale
// entries below are fallbacks only; chrome surfaces (search-result labels)
// keep using them by design.
//   ultimate / ex        →  "<term>: <name>"
//   skill2 / skill3      →  just <name>  (name carries the slot)
//   mastery / awakening  →  `n`          (invariant in-game skill name)
const PREFIX_LABEL_KEY: Partial<Record<SlotKey, string>> = {
  ultimate: 'ultimate',
  ex: 'ex-skill',
}

const INVARIANT_NAME_KEY: Partial<Record<SlotKey, string>> = {
  mastery: 'hero-focus',
  awakening: 'enhance-force',
}

export function headingFor(
  slotKey: SlotKey,
  name: string | null | undefined,
  lang: AppLocale,
  terms?: SkillLocaleFile['_terms'],
): string {
  const invariantKey = INVARIANT_NAME_KEY[slotKey]
  if (invariantKey) return name?.trim() || appLabel(invariantKey, lang)

  const trimmedName = name?.trim() ?? ''
  const prefixKey = PREFIX_LABEL_KEY[slotKey]
  if (!prefixKey) return trimmedName || slotKey
  const term = slotKey === 'ex' ? terms?.ex : terms?.ultimate
  const prefix = term ?? appLabel(prefixKey, lang)
  return trimmedName ? `${prefix}: ${trimmedName}` : prefix
}

// A label template split around its value, so the value can be styled apart.
// `values` is the Lv1 figure and each later level's change; the component
// draws an arrow between them.
export interface SkillMetaItem {
  before: string
  values: string[]
  after: string
}

const fillTemplate = (template: string, token: string, values: string[]): SkillMetaItem => {
  const at = template.indexOf(token)
  return { before: template.slice(0, at), values, after: template.slice(at + token.length) }
}

// A value's Lv1 figure followed by each later level's change, in level order.
function valueChain<K extends keyof SlotValues>(
  numbers: SlotNumbers,
  key: K,
): NonNullable<SlotValues[K]>[] {
  const later = Object.entries(numbers.levels ?? {})
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([, values]) => values[key])
  return [numbers[key], ...later].filter((v): v is NonNullable<SlotValues[K]> => v !== undefined)
}

/** Cooldown and range items for a skill, in the game's skill-panel wording
 * from `_terms`. The cooldown template has one line per value (`${1}` the
 * cooldown, `${2}` the initial cooldown), and a line whose value is absent is
 * dropped. Values are bare numbers, as the game shows them, and a value that a
 * later level changes carries its whole chain. A global range fills the range
 * template with the game's word for it. */
export function skillMetaItems(
  numbers: SlotNumbers | undefined,
  terms: SkillLocaleFile['_terms'] | undefined,
): SkillMetaItem[] {
  if (!numbers || !terms) return []
  const items: SkillMetaItem[] = []
  const cooldowns: Record<string, string[]> = {
    '${1}': valueChain(numbers, 'cooldown').map(String),
    '${2}': valueChain(numbers, 'initialCooldown').map(String),
  }
  for (const line of terms.cooldown.split('\n')) {
    const token = Object.keys(cooldowns).find((t) => line.includes(t))
    const values = token === undefined ? [] : cooldowns[token]!
    if (token && values.length > 0) items.push(fillTemplate(line, token, values))
  }
  const ranges = valueChain(numbers, 'range').map((r) =>
    r === 'global' ? terms.rangeGlobal : String(r),
  )
  if (ranges.length > 0) items.push(fillTemplate(terms.range, '${1}', ranges))
  return items
}

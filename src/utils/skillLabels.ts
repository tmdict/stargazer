import { isAppLocale, type AppLocale, type SkillLocale } from '@/lib/types/i18n'
import type { SkillLocaleFile, SlotKey } from '@/lib/types/skill'
import { getSkillFile, loadAppLocales, loadCharacterLocales } from '@/utils/dataLoader'

/** App-locale label for a key (tag name, slot prefix, etc.); falls back to the key. */
export function appLabel(key: string, lang: AppLocale): string {
  return loadAppLocales()[key]?.[lang] ?? key
}

/** Hero display name in a skill-text language: curated character locales for
 * en/zh, the feed's `_hero.name` elsewhere (falling back to curated en, then
 * the slug). The single copy of this fallback chain, shared by the skill
 * header, search index, and page meta. */
export function heroDisplayName(slug: string, lang: SkillLocale): string {
  const curated = loadCharacterLocales()[slug]
  if (isAppLocale(lang)) return curated?.[lang] ?? slug
  return getSkillFile(lang, slug)?._hero?.name ?? curated?.en ?? slug
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

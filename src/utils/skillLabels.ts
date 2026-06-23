import type { Locale } from '@/lib/types/i18n'
import type { SlotKey } from '@/lib/types/skill'
import { loadAppLocales } from '@/utils/dataLoader'

/** App-locale label for a key (tag name, slot prefix, etc.); falls back to the key. */
export function appLabel(key: string, lang: Locale): string {
  return loadAppLocales()[key]?.[lang] ?? key
}

// Heading composition per slot:
//   ultimate / ex        →  "<prefix>: <name>"   (prefix from app locale)
//   skill2 / skill3      →  just <name>           (name carries the slot)
//   mastery / awakening  →  app-locale name       (invariant across heroes)
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
  lang: Locale,
): string {
  const invariantKey = INVARIANT_NAME_KEY[slotKey]
  if (invariantKey) return appLabel(invariantKey, lang)

  const trimmedName = name?.trim() ?? ''
  const prefixKey = PREFIX_LABEL_KEY[slotKey]
  if (!prefixKey) return trimmedName || slotKey
  const prefix = appLabel(prefixKey, lang)
  return trimmedName ? `${prefix}: ${trimmedName}` : prefix
}

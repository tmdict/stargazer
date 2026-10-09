// i18n type definitions.
//
// Two locale axes: AppLocale is the site chrome (nav, labels, character and
// artifact names), the few languages in APP_LOCALES. SkillLocale is the
// reading language of skill-page text and covers every language the upstream
// skill feed publishes.

// List order is the language menu's order. Adding a site language is a row
// here plus its strings: LocaleData makes every chrome string carry it, and
// routes, the pre-render list, hreflang and the menu derive from the list.
export const APP_LOCALES = ['en', 'zh', 'ko'] as const

export type AppLocale = (typeof APP_LOCALES)[number]

export type LocaleData = Record<AppLocale, string>

export interface LocaleDictionary {
  [category: string]: {
    [key: string]: LocaleData
  }
}

/** True for the languages with chrome strings and curated names; everything
 * downstream branches on this membership. */
export function isAppLocale(value: string): value is AppLocale {
  return (APP_LOCALES as readonly string[]).includes(value)
}

export interface SkillLocaleDef {
  /** Lowercase BCP-47 code: URL prefix, locale dir name, hreflang, html lang. */
  code: SkillLocale
  /** Native-language label shown in the skill-locale menu. */
  native: string
}

// Table order is menu order. Adding a language is a one-row edit here
// (removing one also means deleting its locale dir); the importer, routes,
// SSG route list, hreflang, and the menu all derive from this table.
export const SKILL_LOCALES = [
  { code: 'en', native: 'English' },
  { code: 'zh', native: '简体中文' },
  { code: 'zh-tw', native: '繁體中文' },
  { code: 'ko', native: '한국어' },
  { code: 'ja', native: '日本語' },
  { code: 'fr', native: 'Français' },
  { code: 'de', native: 'Deutsch' },
  { code: 'es', native: 'Español' },
  { code: 'pt', native: 'Português' },
  { code: 'it', native: 'Italiano' },
  { code: 'ru', native: 'Русский' },
  { code: 'th', native: 'ไทย' },
  { code: 'vi', native: 'Tiếng Việt' },
  { code: 'id', native: 'Bahasa Indonesia' },
  { code: 'tr', native: 'Türkçe' },
  { code: 'pl', native: 'Polski' },
] as const

export type SkillLocale = (typeof SKILL_LOCALES)[number]['code']

export const SKILL_LOCALE_CODES: readonly SkillLocale[] = SKILL_LOCALES.map((l) => l.code)

export function isSkillLocale(value: string): value is SkillLocale {
  return (SKILL_LOCALE_CODES as readonly string[]).includes(value)
}

/** A language's label in the site-language menu. Overrides zh with a simpler name. */
export function localeNativeName(code: AppLocale): string {
  if (code === 'zh') return '中文'
  return SKILL_LOCALES.find((l) => l.code === code)!.native
}

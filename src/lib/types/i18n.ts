// i18n type definitions.
//
// Two locale axes: AppLocale is the site chrome (nav, labels, character and
// artifact names) and stays en/zh. SkillLocale is the reading language of
// skill-page text and covers every language the upstream skill feed publishes.

export interface LocaleData {
  en: string
  zh: string
}

export interface LocaleDictionary {
  [category: string]: {
    [key: string]: LocaleData
  }
}

export type AppLocale = 'en' | 'zh'

export const APP_LOCALES: readonly AppLocale[] = ['en', 'zh']

/** True for the languages with chrome strings, curated names, and eagerly
 * bundled skill text; everything downstream branches on this membership. */
export function isAppLocale(value: string): value is AppLocale {
  return (APP_LOCALES as readonly string[]).includes(value)
}

export interface SkillLocaleDef {
  /** Upstream feed directory name (nonstandard codes like kr/jp/ge). */
  feed: string
  /** Lowercase BCP-47 code: URL prefix, locale dir name, hreflang, html lang. */
  code: SkillLocale
  /** Native-language label shown in the skill-locale menu. */
  native: string
}

// Table order is menu order. Adding a language is a one-row edit here
// (removing one also means deleting its locale dir); the importer, routes,
// SSG route list, hreflang, and the menu all derive from this table.
export const SKILL_LOCALES = [
  { feed: 'en', code: 'en', native: 'English' },
  { feed: 'zh', code: 'zh', native: '简体中文' },
  { feed: 'tw', code: 'zh-tw', native: '繁體中文' },
  { feed: 'kr', code: 'ko', native: '한국어' },
  { feed: 'jp', code: 'ja', native: '日本語' },
  { feed: 'fr', code: 'fr', native: 'Français' },
  { feed: 'ge', code: 'de', native: 'Deutsch' },
  { feed: 'sp', code: 'es', native: 'Español' },
  { feed: 'po', code: 'pt', native: 'Português' },
  { feed: 'it', code: 'it', native: 'Italiano' },
  { feed: 'ru', code: 'ru', native: 'Русский' },
  { feed: 'th', code: 'th', native: 'ไทย' },
  { feed: 'vn', code: 'vi', native: 'Tiếng Việt' },
  { feed: 'id', code: 'id', native: 'Bahasa Indonesia' },
  { feed: 'tr', code: 'tr', native: 'Türkçe' },
  { feed: 'pl', code: 'pl', native: 'Polski' },
] as const

export type SkillLocale = (typeof SKILL_LOCALES)[number]['code']

export const SKILL_LOCALE_CODES: readonly SkillLocale[] = SKILL_LOCALES.map((l) => l.code)

export function isSkillLocale(value: string): value is SkillLocale {
  return (SKILL_LOCALE_CODES as readonly string[]).includes(value)
}

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

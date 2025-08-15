// i18n type definitions

export interface LocaleData {
  en: string
  zh: string
}

export interface LocaleDictionary {
  [category: string]: {
    [key: string]: LocaleData
  }
}

export type Locale = 'en' | 'zh'

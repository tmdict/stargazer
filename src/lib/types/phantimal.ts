import type { LocaleData } from './i18n'

// Seasonal Phantimals. Structural data (src/data/seasonal/phantimal/<name>.json);
// localized content (name + skills) lives in the matching locale file.
export interface PhantimalType {
  id: number
  name: string
  season: number
  faction: string // faction slug → game.<faction> label + faction-<faction> icon
}

// src/locales/seasonal/phantimal/<name>.json — full localized content.
export interface PhantimalSkillLocale {
  name: LocaleData
  levels: LocaleData[]
}

export interface PhantimalLocale {
  name: LocaleData
  skills: PhantimalSkillLocale[]
}

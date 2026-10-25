import type { LocaleData } from './i18n'

// Seasonal Phantimals. Structural data (src/data/seasonal/phantimal/<name>.json);
// localized content (name + skills) lives in the matching locale file.
export interface PhantimalType {
  id: number
  name: string
  season: number
  range: number // attack range, used when the phantimal targets on the grid
  damage: string // 'physical' | 'magic' → game.<damage> label + damage-<damage> icon
  faction: string // faction slug → game.<faction> label + faction-<faction> icon
  qualifyingFactions?: readonly string[] // factions counted toward the team requirement; default [faction]
  targeting?: boolean // seasonal skill targeting (Spirit Mark) is live in-game; absent = off
  tags?: readonly string[] // hero tag ids found anywhere in its skill text; absent = none
}

// src/pack/text/seasonal/phantimal/<name>.json: full localized content.
export interface PhantimalSkillLocale {
  name: LocaleData
  levels: LocaleData[]
}

export interface PhantimalLocale {
  name: LocaleData
  skills: PhantimalSkillLocale[]
}

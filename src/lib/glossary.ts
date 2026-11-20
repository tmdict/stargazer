/* The glossary's terms: every term once, under its group, in the order the
 * page lists them. A term's words come from the data pack where the game has
 * them (a stat or a skill keyword of the same key) and from
 * src/locales/glossary/<key>.json otherwise; npm run data checks that each
 * term ends up named and described. Relative imports only: the data step
 * reads this file without the `@` alias. */

import { isAppLocale, type GlossaryWords, type LocaleData, type SkillLocale } from './types/i18n'
import type { GlossaryKeyword } from './types/skill'

export const GLOSSARY_GROUPS = ['stats', 'status', 'control', 'targeting', 'damage'] as const

export type GlossaryGroup = (typeof GLOSSARY_GROUPS)[number]

export const GLOSSARY: Record<GlossaryGroup, readonly string[]> = {
  stats: [
    'hp',
    'atk',
    'phys-def',
    'magic-def',
    'vitality',
    'healing',
    'atk-spd',
    'life-drain',
    'crit',
    'crit-resist',
    'haste',
    'ranged-def',
    'def-penetration',
    'execution',
    'assistance',
    'crit-dmg-boost',
    'crit-dmg-def',
    'energy-regen-reduction',
    'energy-on-hit',
    'debuff-focus',
    'resilience',
    'proficiency',
    'dmg-boost',
    'dmg-reduction',
    'skill-power',
    'ultimate-power',
    'inspiration',
    'intimidation',
    'basic-stats',
    'team-atk',
    'team-hp',
    'dodge-chance',
  ],
  status: ['invincible', 'unaffected', 'steadfast', 'battle-fervor'],
  control: [
    'interruption',
    'displacement',
    'stun',
    'freeze',
    'immobilize',
    'entangle',
    'imprison',
    'airborne',
    'knockback',
    'knockdown',
    'charmed',
    'taunt',
    'fright',
    'bewitch',
    'hypnotize',
    'confuse',
    'devour',
    'transform',
    'silence',
    'disarm',
    'blind',
  ],
  targeting: [
    'weakest',
    'healthiest',
    'nearest-farthest',
    'frontmost',
    'rearmost',
    'behind',
    'isolated',
    'closest-to-enemies',
    'tile-in-front',
    'tile-behind',
    'straight-path',
    'same-row',
    'symmetrical',
    'point-symmetrical',
    'central-axis',
    'battlefield-edge',
  ],
  damage: [
    'base-damage',
    'melee-damage',
    'ranged-damage',
    'continuous-damage',
    'single-high-value-damage',
    'multiple-consecutive-damage',
    'hp-loss',
    'max-hp-reduction',
    'fatal-blow',
    'immediately-defeated',
    'assist-or-defeat',
  ],
}

/** A term's name and description in `lang`: the game's words in the data pack
 * first, the site's own where the game has none. The note is the site's own
 * either way. The site's words exist in the app languages alone, and a blank
 * string counts as no words. */
export function glossaryWords(
  game: GlossaryKeyword | undefined,
  site: GlossaryWords | undefined,
  lang: SkillLocale,
): { name: string | undefined; description: string | undefined; note: string | undefined } {
  const own = (text?: Partial<LocaleData>): string | undefined =>
    isAppLocale(lang) ? text?.[lang] : undefined
  return {
    name: game?.n || own(site?.name) || undefined,
    description: game?.d || own(site?.description) || undefined,
    note: own(site?.note) || undefined,
  }
}

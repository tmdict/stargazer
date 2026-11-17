/* The four ways a skill lowers HP, and which effects apply to each. */

export const DAMAGE_TYPES = ['regular', 'true-damage', 'hp-loss', 'absolute-hp-loss'] as const

export type DamageType = (typeof DAMAGE_TYPES)[number]

export interface DamageRule {
  // Names the rule's text, `damage-row-<key>`, and its note, `damage-row-<key>-note`.
  key: string
  note?: boolean
  // Whether the rule holds for each of DAMAGE_TYPES, in that order.
  applies: readonly [boolean, boolean, boolean, boolean]
}

export const DAMAGE_RULES: readonly DamageRule[] = [
  { key: 'bonuses', note: true, applies: [true, true, false, false] },
  { key: 'crit', applies: [true, true, false, false] },
  { key: 'defense', note: true, applies: [true, false, false, false] },
  { key: 'shields', applies: [true, false, false, false] },
  { key: 'life-drain', applies: [false, true, false, false] },
  { key: 'immunity', applies: [true, true, true, false] },
  { key: 'fatal', applies: [true, true, false, false] },
  { key: 'hp-loss-effects', note: true, applies: [true, true, true, false] },
]

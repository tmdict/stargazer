/* What each hero upgrade level grants: the stat ramps behind the guide's
 * Paragon / EX Refinement tables and the panel's Rivalry maths. Every ramp is
 * linear (base + step × level, level 0 .. attrMax), which is what lets the
 * guide state "+15 per level" and the per-level table from one definition.
 * Paragon has two ramps per stat: Celestial and Hypogean heroes start above
 * zero at P0 and climb in smaller steps, meeting every other faction at P4.
 */

import { ATTR_REFINEMENT, attrMax } from './attributes'

export type ParagonGroup = 'standard' | 'celestialHypogean'

export const paragonGroup = (faction?: string): ParagonGroup =>
  faction === 'celestial' || faction === 'hypogean' ? 'celestialHypogean' : 'standard'

// Stats that share one ramp are listed together; `stats` are app locale keys.
export interface StatRamp {
  stats: readonly string[]
  base: number
  step: number
}

export interface ParagonRamps {
  energy: StatRamp
  combat: StatRamp
  rivalry: StatRamp
}

const ENERGY = ['energy-regen-reduction', 'energy-on-hit'] as const
const COMBAT = ['debuff-focus', 'resilience', 'dmg-boost', 'dmg-reduction'] as const
const RIVALRY = ['inspiration', 'intimidation'] as const

export const PARAGON_RAMPS: Readonly<Record<ParagonGroup, ParagonRamps>> = {
  standard: {
    energy: { stats: ENERGY, base: 0, step: 15 },
    combat: { stats: COMBAT, base: 0, step: 6 },
    rivalry: { stats: RIVALRY, base: 0, step: 4.5 },
  },
  celestialHypogean: {
    energy: { stats: ENERGY, base: 14, step: 11.5 },
    combat: { stats: COMBAT, base: 6, step: 4.5 },
    rivalry: { stats: RIVALRY, base: 4, step: 3.5 },
  },
}

export const REFINEMENT_RAMPS: readonly StatRamp[] = [
  { stats: ENERGY, base: 0, step: 4 },
  { stats: ['dmg-boost', 'dmg-reduction'], base: 0, step: 2 },
]

export const rampValue = (ramp: StatRamp, level: number): number => ramp.base + ramp.step * level

export const rampValues = (ramp: StatRamp, attrId: number): number[] =>
  Array.from({ length: attrMax(attrId) + 1 }, (_, level) => rampValue(ramp, level))

/* Pill tone for a level, shared by the panel's portrait pills and the guide's
 * level headers: paragon colors at max only, while refinement warms up from
 * R2 so mid progress shows without stealing the maxed pop. */
export type PillTone = 'base' | 'mid' | 'max'

export const pillTone = (attrId: number, level: number): PillTone =>
  level >= attrMax(attrId) ? 'max' : attrId === ATTR_REFINEMENT && level >= 2 ? 'mid' : 'base'

/* What each hero upgrade level grants: the stat ramps behind the guide's
 * Paragon / EX Refinement tables and the panel's Rivalry maths. Every ramp is
 * linear (base + step × level, level 0 .. attrMax), which is what lets the
 * guide state "+15 per level" and the per-level table from one definition.
 * Paragon has two ramps per stat: Celestial and Hypogean heroes start above
 * zero at P0 and climb in smaller steps, meeting every other faction at P4.
 */

import { FACTION_ORDER } from '@/lib/filterOrder'
import { ATTR_PARAGON, ATTR_REFINEMENT, attrMax, HERO_ATTRS } from './attributes'

export type ParagonGroup = 'standard' | 'celestialHypogean'

export const paragonGroup = (faction?: string): ParagonGroup =>
  faction === 'celestial' || faction === 'hypogean' ? 'celestialHypogean' : 'standard'

/** The factions on a paragon ramp, in hero list order. */
export const paragonFactions = (group: ParagonGroup): string[] =>
  FACTION_ORDER.filter((faction) => paragonGroup(faction) === group)

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

/* Reads the variables.css tokens named after the attribute:
 * --upgrade-pill-<name>-<level>, and -max at the top level. */
export const pillFill = (attrId: number, level: number): string => {
  if (level <= 0) return 'var(--upgrade-pill-gray)'
  const name = HERO_ATTRS.find((attr) => attr.id === attrId)?.name
  return `var(--upgrade-pill-${name}-${level >= attrMax(attrId) ? 'max' : level})`
}

// The white sliver keeps the slanted split visible when both halves share a fill.
export const pillBackground = (paragon: number, refinement: number): string =>
  `linear-gradient(112deg, ${pillFill(ATTR_PARAGON, paragon)} 48.6%, #fff 49.4%, #fff 50.6%, ${pillFill(ATTR_REFINEMENT, refinement)} 51.4%)`

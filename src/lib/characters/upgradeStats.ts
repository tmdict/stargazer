/* What each hero upgrade level grants: the stat ramps behind the guide's
 * Paragon / EX Refinement tables and the panel's Rivalry maths. Every ramp is
 * linear (base + step × level, level 0 .. attrMax), which is what lets the
 * guide state "+15 per level" and the per-level table from one definition.
 * Paragon has two ramps per stat: Celestial and Hypogean heroes start above
 * zero at P0 and climb in smaller steps, meeting every other faction at P4.
 * The numbers are in src/data/upgrades.json, which the external report
 * generator also reads, and each ramp takes its stats here by its name there.
 */

import upgrades from '@/data/upgrades.json'
import { FACTION_ORDER } from '@/lib/filterOrder'
import { ATTR_PARAGON, ATTR_REFINEMENT, attrMax, HERO_ATTRS } from './attributes'

export type ParagonGroup = 'standard' | 'celestialHypogean'

const { paragon, refinement } = upgrades
const CELESTIAL_HYPOGEAN: readonly string[] = paragon.ramps.celestialHypogean.factions

export const paragonGroup = (faction?: string): ParagonGroup =>
  faction !== undefined && CELESTIAL_HYPOGEAN.includes(faction) ? 'celestialHypogean' : 'standard'

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

interface Ramp {
  base: number
  step: number
}

const ramp = (stats: readonly string[], { base, step }: Ramp): StatRamp => ({ stats, base, step })

const paragonRamps = (group: Record<keyof ParagonRamps, Ramp>): ParagonRamps => ({
  energy: ramp(ENERGY, group.energy),
  combat: ramp(COMBAT, group.combat),
  rivalry: ramp(RIVALRY, group.rivalry),
})

export const PARAGON_RAMPS: Readonly<Record<ParagonGroup, ParagonRamps>> = {
  standard: paragonRamps(paragon.ramps.standard),
  celestialHypogean: paragonRamps(paragon.ramps.celestialHypogean),
}

export const REFINEMENT_RAMPS: readonly StatRamp[] = [
  ramp(ENERGY, refinement.ramps.energy),
  ramp(['dmg-boost', 'dmg-reduction'], refinement.ramps.damage),
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

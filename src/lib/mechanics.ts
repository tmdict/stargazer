/* The mechanic filter of a hero list: a tag pick, or the initial energy pick.
 * The tag rules live in tags.ts; this holds the energy rule, the pick that is
 * either, and its link. Pure and free of the data loader, like tags.ts. */

import { fromTagQuery, matchesPick, toTagQuery, type TagVocabulary } from '@/lib/tags'
import type { CharacterType } from '@/lib/types/character'
import type { TagPick } from '@/lib/types/skill'

/** The energy filter's label key, its place among the tag keys and its card's
 * id on the Mechanics guide. */
export const ENERGY_KEY = 'init-energy'

export const ENERGY_MIN = 0
export const ENERGY_MAX = 900
export const ENERGY_STEP = 100
export const ENERGY_DEFAULT = 500

type HeroEnergy = Pick<CharacterType, 'energy'>

/** A hero file lists the energy the hero starts a battle with, which is the
 * game's value, then what its skills add to that. */
export const ownEnergy = (hero: HeroEnergy): number => hero.energy[0] ?? 0

export const addedEnergy = (hero: HeroEnergy): number =>
  hero.energy.slice(1).reduce((sum, n) => sum + n, 0)

export const totalEnergy = (hero: HeroEnergy): number => ownEnergy(hero) + addedEnergy(hero)

/** Heroes whose total starting energy is above the value. */
interface EnergyPick {
  readonly energyAbove: number
}

export type MechanicPick = TagPick | EnergyPick

export const isEnergyPick = (pick: MechanicPick): pick is EnergyPick => 'energyAbove' in pick

/** How the rule reads beside its value, the same in every language. */
export const energyAboveLabel = (value: number): string => `> ${value}`

export const pickKey = (pick: MechanicPick): string => (isEnergyPick(pick) ? ENERGY_KEY : pick.tag)

/** The picks with skill text behind them: energy belongs to the hero, not to
 * a skill level. */
export const tagPicksOf = (picks: readonly MechanicPick[]): TagPick[] =>
  picks.filter((pick): pick is TagPick => !isEnergyPick(pick))

export function matchesMechanic(
  hero: Pick<CharacterType, 'tags' | 'energy'>,
  pick: MechanicPick,
): boolean {
  return isEnergyPick(pick) ? totalEnergy(hero) > pick.energyAbove : matchesPick(hero.tags, pick)
}

/** Every mechanic a hero can be filtered by, in the order menus and the guide
 * list them: the tags with the energy filter among them. */
export const mechanicKeys = (vocabulary: TagVocabulary): string[] =>
  [...vocabulary.keys(), ENERGY_KEY].sort()

/** Query of a mechanic link: a tag link, or `?energy=500`. */
export function toMechanicQuery(
  pick: MechanicPick,
): { tag: string; mods?: string } | { energy: string } {
  return isEnergyPick(pick) ? { energy: String(pick.energyAbove) } : toTagQuery(pick)
}

/** The pick a link names, or null. A link carries a tag or an energy value.
 * One with both, with a value the filter cannot be stepped to, or with the
 * value written any other way than `toMechanicQuery` writes it (`0500`,
 * `5e2`) is no filter at all, as for a tag link. */
export function fromMechanicQuery(
  query: { tag?: unknown; mods?: unknown; energy?: unknown },
  vocabulary: TagVocabulary,
): MechanicPick | null {
  const { tag, mods, energy } = query
  if (energy === undefined) return fromTagQuery(query, vocabulary)
  if (tag !== undefined || mods !== undefined || typeof energy !== 'string') return null
  const value = Number(energy)
  const plain = String(value) === energy
  const onStep = value >= ENERGY_MIN && value <= ENERGY_MAX && value % ENERGY_STEP === 0
  return plain && onStep ? { energyAbove: value } : null
}

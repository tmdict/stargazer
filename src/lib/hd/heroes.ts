// Honor Duel's units as its pickers list them: the heroes its shop sells, the
// same for every player, and what each Trial Card brings.

import { toTrialPick } from '@/lib/characters/trial'
import { compareCharacters } from '@/lib/filterOrder'
import type { CharacterType } from '@/lib/types/character'
import { DUEL_TIERS } from './board'
import { duelSourceTiers, isShopHero, TRIAL_CARDS } from './units'

export const duelHeroes = (characters: readonly CharacterType[]): CharacterType[] =>
  characters.filter((character) => isShopHero(character.name)).sort(compareCharacters)

/** The shop's heroes as Trial picks, each under its pick id (toTrialPick) at
 * the lowest tier a Trial Card brings it at. A hero no card brings is left
 * out. */
export const duelTrialHeroes = (characters: readonly CharacterType[]): CharacterType[] =>
  duelHeroes(characters).flatMap((hero) => {
    const [tier] = duelSourceTiers(hero.name, true)
    return tier === undefined ? [] : [{ ...hero, id: toTrialPick(hero.id, tier) }]
  })

interface TrialGroup {
  // The card's name in the shop's product list.
  card: string
  // Whether the card names creatures alone.
  creatures: boolean
  // Each unit under its pick id (toTrialPick), which carries the card's tier.
  units: CharacterType[]
}

/** The units a Trial Card names of the given heroes and creatures, a group
 * per card: the cards that name heroes, then the creatures'. A unit the list
 * lacks is left out, and so is a card left with none. The shop's heroes,
 * which a card brings without naming them, are duelTrialHeroes. */
export function duelTrialGroups(units: readonly CharacterType[]): TrialGroup[] {
  return TRIAL_CARDS.map((card) => {
    const tier = DUEL_TIERS.indexOf(card.tier)
    const named = units.filter((unit) => card.units?.includes(unit.name)).sort(compareCharacters)
    return {
      card: card.card,
      creatures: named.every((unit) => unit.creature),
      units: named.map((unit) => ({ ...unit, id: toTrialPick(unit.id, tier) })),
    }
  })
    .filter((group) => group.units.length > 0)
    .sort((a, b) => Number(a.creatures) - Number(b.creatures))
}

// Honor Duel's units as its pickers list them: the heroes its shop sells, the
// same for every player, and what each Trial Card brings.

import { toTrialPick } from '@/lib/characters/trial'
import { compareCharacters } from '@/lib/filterOrder'
import type { CharacterType } from '@/lib/types/character'
import { DUEL_TIERS } from './board'
import { isShopHero, TRIAL_CARDS, trialCardBrings } from './units'

export const duelHeroes = (characters: readonly CharacterType[]): CharacterType[] =>
  characters.filter((character) => isShopHero(character.name)).sort(compareCharacters)

export interface TrialGroup {
  // The card's name in the shop's product list.
  card: string
  // Each unit under its pick id (toTrialPick), which carries the card's tier.
  units: CharacterType[]
}

/** What each Trial Card brings of the given heroes and creatures, cheapest
 * card first. A unit the list lacks is left out, and so is a card left with
 * none. */
export function duelTrialGroups(units: readonly CharacterType[]): TrialGroup[] {
  return TRIAL_CARDS.map((card) => {
    const tier = DUEL_TIERS.indexOf(card.tier)
    return {
      card: card.card,
      units: units
        .filter((unit) => trialCardBrings(card, unit.name))
        .sort(compareCharacters)
        .map((unit) => ({ ...unit, id: toTrialPick(unit.id, tier) })),
    }
  }).filter((group) => group.units.length > 0)
}

/** Every unit of the groups once, under the pick of the cheapest card that
 * brings it. */
export function duelTrialPool(groups: readonly TrialGroup[]): CharacterType[] {
  const first = new Map<string, CharacterType>()
  for (const unit of groups.flatMap((group) => group.units)) {
    if (!first.has(unit.name)) first.set(unit.name, unit)
  }
  return [...first.values()]
}

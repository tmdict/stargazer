// Honor Duel's units as its pickers list them: the heroes its shop sells, the
// same for every player, and what each Trial Card brings.

import { toTrialPick } from '@/lib/characters/trial'
import { compareCharacters } from '@/lib/filterOrder'
import type { CharacterType } from '@/lib/types/character'
import type { AppLocale, LocaleData } from '@/lib/types/i18n'
import { fileStem } from '@/utils/fileStem'
import { formatDisplayName } from '@/utils/nameFormatting'
import { DUEL_TIERS } from './board'
import { SHOP_FACTS } from './shop/goods'
import { TRIAL_CARDS } from './units'

const DUEL_HERO_NAMES = new Set(SHOP_FACTS.heroes)

export const duelHeroes = (characters: readonly CharacterType[]): CharacterType[] =>
  characters.filter((character) => DUEL_HERO_NAMES.has(character.name)).sort(compareCharacters)

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
  const byName = new Map(units.map((unit) => [unit.name, unit]))
  const shop = duelHeroes(units)
  return TRIAL_CARDS.map(({ card, tier, units: names = [], shop: sold }) => {
    const brought = new Set([
      ...names.flatMap((name) => byName.get(name) ?? []),
      ...(sold ? shop : []),
    ])
    const position = DUEL_TIERS.indexOf(tier)
    return {
      card,
      units: [...brought]
        .sort(compareCharacters)
        .map((unit) => ({ ...unit, id: toTrialPick(unit.id, position) })),
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

const cardNames = Object.fromEntries(
  Object.entries(
    import.meta.glob<LocaleData>('@/locales/hd/shop/trial-card-*.json', {
      eager: true,
      import: 'default',
    }),
  ).map(([path, names]) => [fileStem(path), names]),
)

export const trialCardName = (card: string, locale: AppLocale): string =>
  cardNames[card]?.[locale] || formatDisplayName(card)

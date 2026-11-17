// Honor Duel's heroes: the ones its shop sells, the same for every player.

import { compareCharacters } from '@/lib/filterOrder'
import type { CharacterType } from '@/lib/types/character'
import { SHOP_FACTS } from './shop/goods'

const DUEL_HERO_NAMES = new Set(SHOP_FACTS.heroes)

export const duelHeroes = (characters: readonly CharacterType[]): CharacterType[] =>
  characters.filter((character) => DUEL_HERO_NAMES.has(character.name)).sort(compareCharacters)
